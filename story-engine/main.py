"""
Story Engine - FastAPI Microservice for RolIA
Provides narrative analysis, NPC AI, and story state management.
"""

import json
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from config import get_settings
import db_client
import redis_client
from models import (
    PlayerAction,
    ActionAnalysis,
    ContextRequest,
    ContextResponse,
    StoryState,
    ProgressUpdate,
    NPCReaction,
    DecisionResult,
    PendingDecision,
)
from services import (
    NarrativeAnalyzer,
    StoryGraph,
    NPCBrain,
    TwistEngine,
    KarmaSystem,
    ContextBuilder,
)
from services.narrative_analyzer import get_analyzer
from services.story_graph import get_campaign_graph, set_campaign_graph
from services.npc_brain import get_npc_brain
from services.twist_engine import get_twist_engine
from services.karma_system import get_karma_system
from services.context_builder import get_context_builder

settings = get_settings()


# ===========================================
# Request/Response Models
# ===========================================

class AnalyzeActionRequest(BaseModel):
    room_id: int
    user_id: int
    username: str
    message: str
    character_name: Optional[str] = None
    character_class: Optional[str] = None


class ProcessDecisionRequest(BaseModel):
    room_id: int
    decision_code: str
    chosen_option: str


class ProcessResponseRequest(BaseModel):
    room_id: int
    ai_response: str
    markers: Dict[str, Any] = {}


class NPCReactionRequest(BaseModel):
    room_id: int
    npc_code: str
    action_type: str
    action_details: Optional[Dict[str, Any]] = None


class CheckTriggerRequest(BaseModel):
    room_id: int
    trigger_type: str
    trigger_data: Optional[Dict[str, Any]] = None


class InitializeProgressRequest(BaseModel):
    room_id: int
    campaign_id: int


# ===========================================
# Lifespan Management
# ===========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown."""
    # Startup
    print("Starting Story Engine...")
    await db_client.init_db()
    await redis_client.init_redis()
    print("Story Engine started successfully")

    yield

    # Shutdown
    print("Shutting down Story Engine...")
    await db_client.close_db()
    await redis_client.close_redis()
    print("Story Engine shutdown complete")


# ===========================================
# FastAPI Application
# ===========================================

app = FastAPI(
    title="Story Engine",
    description="Narrative analysis and story management for RolIA",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================
# Health Check
# ===========================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    redis_ok = await redis_client.health_check()
    return {
        "status": "healthy" if redis_ok else "degraded",
        "redis": "connected" if redis_ok else "disconnected",
        "version": "1.0.0"
    }


# ===========================================
# Action Analysis
# ===========================================

@app.post("/analyze-action", response_model=ActionAnalysis)
async def analyze_action(request: AnalyzeActionRequest):
    """
    Analyze a player's action/message.
    Returns intent classification, karma effects, and triggers.
    """
    # Get story state for context
    story_state = await redis_client.get_story_state(request.room_id)
    if not story_state:
        db_progress = await db_client.get_room_progress(request.room_id)
        if db_progress:
            story_state = {
                "current_scene_type": None,
                "active_npcs": [],
            }
            # Load scene for context
            scene = await db_client.get_current_scene_full(request.room_id)
            if scene:
                story_state["current_scene_type"] = scene.get("scene_type")
                story_state["active_npcs"] = [
                    n.get("code") if isinstance(n, dict) else n
                    for n in scene.get("key_npcs", [])
                ]

    # Create player action
    action = PlayerAction(
        room_id=request.room_id,
        user_id=request.user_id,
        username=request.username,
        message=request.message,
        character_name=request.character_name,
        character_class=request.character_class,
        current_scene_type=story_state.get("current_scene_type") if story_state else None,
        active_npcs=story_state.get("active_npcs", []) if story_state else [],
    )

    # Analyze
    analyzer = get_analyzer()
    analysis = analyzer.analyze(action)

    return analysis


# ===========================================
# Context Building
# ===========================================

@app.post("/get-context", response_model=ContextResponse)
async def get_context(request: ContextRequest):
    """
    Build enriched context for AI narrative generation.
    """
    try:
        builder = get_context_builder()
        context = await builder.build_context(request)
        return context
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/ai-context/{room_id}")
async def get_ai_context(room_id: int):
    """
    Get simplified AI context formatted for system prompt.
    """
    try:
        builder = get_context_builder()
        context = await builder.build_ai_context(room_id)
        return {
            "context": context.model_dump(),
            "formatted": context.to_system_prompt_section()
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ===========================================
# Decision Processing
# ===========================================

@app.post("/process-decision", response_model=DecisionResult)
async def process_decision(request: ProcessDecisionRequest):
    """
    Process a player decision and return consequences.
    """
    # Get decision details
    decision = await db_client.get_decision(request.decision_code)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Get current progress
    progress = await db_client.get_room_progress(request.room_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Room progress not found")

    # Find chosen option
    options = decision.get("options", [])
    chosen = None
    for opt in options:
        if opt.get("id") == request.chosen_option:
            chosen = opt
            break

    if not chosen:
        raise HTTPException(status_code=400, detail="Invalid option")

    # Calculate effects
    karma_change = chosen.get("karma_effect", 0)
    flags_set = chosen.get("consequence_flags", [])

    # Get consequences from decision
    consequences = decision.get("consequences", {})
    option_consequences = consequences.get(request.chosen_option, {})

    # Build result
    result = DecisionResult(
        decision_code=request.decision_code,
        chosen_option=request.chosen_option,
        karma_change=karma_change,
        flags_set=flags_set,
        new_scene_id=option_consequences.get("next_scene"),
        npc_reactions=option_consequences.get("npc_reactions", {}),
        reveals_clues=option_consequences.get("reveals_clues", []),
        unlocks_side_story=option_consequences.get("unlocks_side_story"),
        narration_hint=option_consequences.get("narration_hint"),
    )

    # Update progress in database
    new_flags = {f: True for f in flags_set}
    await db_client.update_room_progress(
        request.room_id,
        karma=progress.get("karma", 50) + karma_change,
        add_flags=new_flags,
        add_decision={request.decision_code: request.chosen_option},
        clear_pending_decision=True,
    )

    # Update Redis state
    await redis_client.clear_pending_decision(request.room_id)
    await redis_client.invalidate_ai_context(request.room_id)

    # Log event
    await db_client.log_story_event(
        request.room_id,
        "decision_made",
        {
            "decision_code": request.decision_code,
            "chosen_option": request.chosen_option,
            "karma_change": karma_change,
        }
    )

    return result


@app.get("/pending-decision/{room_id}")
async def get_pending_decision(room_id: int):
    """Get any pending decision for a room."""
    pending = await redis_client.get_pending_decision(room_id)
    if not pending:
        # Check DB
        progress = await db_client.get_room_progress(room_id)
        if progress and progress.get("pending_decision_code"):
            decision = await db_client.get_decision(progress["pending_decision_code"])
            if decision:
                pending = {
                    "decision_code": decision["decision_code"],
                    "title": decision["title"],
                    "options": decision["options"],
                    "turns_remaining": progress.get("pending_decision_turns"),
                }

    return {"pending_decision": pending}


@app.post("/set-pending-decision")
async def set_pending_decision(room_id: int, decision_code: str, turns: int = 3):
    """Set a pending decision for a room."""
    decision = await db_client.get_decision(decision_code)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    pending = {
        "decision_code": decision_code,
        "title": decision["title"],
        "options": decision["options"],
        "turns_remaining": turns,
    }

    await redis_client.set_pending_decision(room_id, pending)
    await db_client.update_room_progress(
        room_id,
        pending_decision_code=decision_code,
    )

    return {"status": "ok", "pending_decision": pending}


# ===========================================
# NPC Reactions
# ===========================================

@app.post("/npc-reaction", response_model=NPCReaction)
async def calculate_npc_reaction(request: NPCReactionRequest):
    """
    Calculate how an NPC reacts to a player action.
    """
    # Get room progress for campaign ID
    progress = await db_client.get_room_progress(request.room_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Room progress not found")

    campaign_id = progress["campaign_id"]

    # Get NPC data
    npc_data = await db_client.get_npc(campaign_id, request.npc_code)
    if not npc_data:
        raise HTTPException(status_code=404, detail="NPC not found")

    # Get relationship
    npc_id = npc_data["id"]
    relationship_data = await db_client.get_room_npc_relationship(
        request.room_id, npc_id
    )

    # Create NPC state and relationship models
    from models.npc import NPCState, NPCPersonality, NPCRelationship

    npc_state = NPCState(
        npc_id=npc_id,
        code=request.npc_code,
        name=npc_data["name"],
        apparent_role=npc_data.get("apparent_role", "unknown"),
        true_role=npc_data.get("true_role"),
        description=npc_data.get("description"),
        personality=NPCPersonality(**npc_data.get("personality", {})),
        secrets=npc_data.get("secrets", []),
        dialogue_style=npc_data.get("dialogue_style"),
        betrayal_threshold=npc_data.get("betrayal_threshold"),
        redemption_threshold=npc_data.get("redemption_threshold"),
        is_major=npc_data.get("is_major", False),
    )

    relationship = NPCRelationship(
        room_id=request.room_id,
        npc_id=npc_id,
        npc_code=request.npc_code,
        npc_name=npc_data["name"],
        relationship_score=relationship_data.get("relationship_score", 50) if relationship_data else 50,
        trust_level=relationship_data.get("trust_level", 50) if relationship_data else 50,
        emotional_state=relationship_data.get("emotional_state", "neutral") if relationship_data else "neutral",
        known_secrets=relationship_data.get("known_secrets", []) if relationship_data else [],
        interactions_count=relationship_data.get("interactions_count", 0) if relationship_data else 0,
        betrayal_triggered=relationship_data.get("betrayal_triggered", False) if relationship_data else False,
        redemption_triggered=relationship_data.get("redemption_triggered", False) if relationship_data else False,
    )

    # Calculate reaction
    npc_brain = get_npc_brain()
    reaction = npc_brain.calculate_reaction(
        npc_state,
        relationship,
        "",  # Player action text not needed here
        request.action_type,
        request.action_details or {}
    )

    # Update relationship in database
    new_relationship = relationship.relationship_score + reaction.relationship_change
    new_trust = relationship.trust_level + reaction.trust_change

    await db_client.upsert_room_npc_relationship(
        request.room_id,
        npc_id,
        relationship_score=new_relationship,
        trust_level=new_trust,
        emotional_state=reaction.emotional_response,
        add_secret=reaction.reveals_secret,
        increment_interactions=True,
        betrayal_triggered=reaction.triggers_betrayal or None,
        redemption_triggered=reaction.triggers_redemption or None,
    )

    # Update Redis memory
    await redis_client.update_npc_memory(
        request.room_id,
        request.npc_code,
        {
            "relationship": new_relationship,
            "trust": new_trust,
            "emotional_state": reaction.emotional_response,
        }
    )

    # Add interaction to memory
    await redis_client.add_npc_interaction(
        request.room_id,
        request.npc_code,
        request.action_type,
        json.dumps(request.action_details or {})
    )

    return reaction


# ===========================================
# Story State
# ===========================================

@app.get("/story-state/{room_id}")
async def get_story_state(room_id: int):
    """Get current story state for a room."""
    # Try Redis first
    state = await redis_client.get_story_state(room_id)

    if not state:
        # Load from database
        progress = await db_client.get_room_progress(room_id)
        if not progress:
            raise HTTPException(status_code=404, detail="Room progress not found")

        state = {
            "room_id": room_id,
            "campaign_id": progress["campaign_id"],
            "campaign_name": progress.get("campaign_name"),
            "current_act": progress["current_act"],
            "current_chapter": progress["current_chapter"],
            "current_scene": progress["current_scene"],
            "karma": progress["karma"],
            "faction_standings": progress.get("faction_standings", {}),
            "decisions_made": progress.get("decisions_made", {}),
            "story_flags": progress.get("story_flags", {}),
            "revealed_clues": progress.get("revealed_clues", []),
            "ending_path": progress.get("ending_path"),
            "pending_decision": progress.get("pending_decision_code"),
        }

        # Cache in Redis
        await redis_client.set_story_state(room_id, state)

    return state


@app.post("/initialize-progress")
async def initialize_progress(request: InitializeProgressRequest):
    """Initialize story progress for a room with a campaign."""
    # Check if room exists
    room_exists = await db_client.room_exists(request.room_id)
    if not room_exists:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check if progress already exists
    existing = await db_client.get_room_progress(request.room_id)
    if existing:
        raise HTTPException(status_code=400, detail="Progress already exists")

    # Check campaign exists
    campaign = await db_client.get_campaign(request.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Create progress
    progress = await db_client.create_room_progress(
        request.room_id,
        request.campaign_id
    )

    # Initialize Redis state
    state = {
        "room_id": request.room_id,
        "campaign_id": request.campaign_id,
        "current_act": 1,
        "current_chapter": 1,
        "current_scene": 1,
        "karma": 50,
        "faction_standings": {},
        "decisions_made": {},
        "story_flags": {},
        "revealed_clues": [],
    }
    await redis_client.set_story_state(request.room_id, state)

    # Log event
    await db_client.log_story_event(
        request.room_id,
        "campaign_started",
        {"campaign_id": request.campaign_id, "campaign_name": campaign["name"]}
    )

    return {"status": "ok", "progress": progress}


@app.post("/update-progress")
async def update_progress(update: ProgressUpdate):
    """Update story progress for a room."""
    # Update database
    new_karma = None
    if update.karma_change:
        progress = await db_client.get_room_progress(update.room_id)
        if progress:
            new_karma = max(0, min(100, progress["karma"] + update.karma_change))

    await db_client.update_room_progress(
        update.room_id,
        current_act=update.new_act,
        current_chapter=update.new_chapter,
        current_scene=update.new_scene,
        karma=new_karma,
        add_flags=update.new_flags,
        add_decision=update.decision_made,
        add_clues=update.new_clues,
    )

    # Update Redis state
    redis_updates = {}
    if update.new_act:
        redis_updates["current_act"] = update.new_act
    if update.new_chapter:
        redis_updates["current_chapter"] = update.new_chapter
    if update.new_scene:
        redis_updates["current_scene"] = update.new_scene
    if new_karma is not None:
        redis_updates["karma"] = new_karma

    if redis_updates:
        await redis_client.update_story_state(update.room_id, redis_updates)

    # Invalidate AI context cache
    await redis_client.invalidate_ai_context(update.room_id)

    return {"status": "ok"}


# ===========================================
# Trigger Checking
# ===========================================

@app.post("/check-trigger")
async def check_trigger(request: CheckTriggerRequest):
    """Check if a trigger condition is met."""
    progress = await db_client.get_room_progress(request.room_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Room progress not found")

    triggered = False
    trigger_data = None

    if request.trigger_type == "decision":
        # Check if conditions met for a decision trigger
        decision_code = request.trigger_data.get("decision_code") if request.trigger_data else None
        if decision_code:
            decision = await db_client.get_decision(decision_code)
            if decision:
                # Check if decision hasn't been made yet
                if decision_code not in progress.get("decisions_made", {}):
                    triggered = True
                    trigger_data = {
                        "decision_code": decision_code,
                        "title": decision["title"],
                    }

    elif request.trigger_type == "revelation":
        # Check if a revelation should happen
        campaign_id = progress["campaign_id"]
        story_state = {
            "current_act": progress["current_act"],
            "revealed_clues": progress.get("revealed_clues", []),
            "story_flags": progress.get("story_flags", {}),
            "tension_level": request.trigger_data.get("tension_level", "normal") if request.trigger_data else "normal",
        }

        twist_engine = get_twist_engine(campaign_id)
        twist = twist_engine.check_revelation_timing(story_state)
        if twist:
            triggered = True
            trigger_data = twist_engine.get_revelation_context(twist)

    elif request.trigger_type == "side_story":
        # Check if a side story should trigger
        pass  # Implement side story trigger logic

    return {
        "triggered": triggered,
        "trigger_type": request.trigger_type,
        "trigger_data": trigger_data
    }


# ===========================================
# Ending Calculation
# ===========================================

@app.get("/calculate-ending/{room_id}")
async def calculate_ending(room_id: int):
    """Calculate current ending probabilities."""
    progress = await db_client.get_room_progress(room_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Room progress not found")

    campaign_id = progress["campaign_id"]

    # Get or build story graph
    graph = get_campaign_graph(campaign_id)
    if not graph:
        # Build graph from campaign data
        graph = StoryGraph()
        # Load campaign structure and build graph
        # This would need full campaign data loading
        set_campaign_graph(campaign_id, graph)

    # Calculate probabilities
    current_node = f"scene_{progress['current_scene']}"
    probabilities = graph.calculate_ending_probabilities(
        current_node,
        progress.get("decisions_made", {}),
        progress.get("story_flags", {})
    )

    # Get most likely ending
    most_likely = max(probabilities, key=probabilities.get) if probabilities else None

    return {
        "probabilities": probabilities,
        "most_likely_ending": most_likely,
        "karma": progress["karma"],
        "decisions_count": len(progress.get("decisions_made", {})),
    }


# ===========================================
# Campaign Management
# ===========================================

@app.get("/campaigns")
async def list_campaigns(theme_id: Optional[int] = None):
    """List available campaigns."""
    campaigns = await db_client.list_campaigns(theme_id)
    return {"campaigns": campaigns}


@app.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: int):
    """Get campaign details."""
    campaign = await db_client.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


# ===========================================
# Process AI Response
# ===========================================

@app.post("/process-response")
async def process_ai_response(request: ProcessResponseRequest):
    """
    Process AI response markers and update state accordingly.
    Called after Groq generates a response.
    """
    markers = request.markers
    updates_made = []

    # Process karma markers
    if "karma" in markers:
        karma_change = markers["karma"]
        progress = await db_client.get_room_progress(request.room_id)
        if progress:
            new_karma = max(0, min(100, progress["karma"] + karma_change))
            await db_client.update_room_progress(request.room_id, karma=new_karma)
            await redis_client.update_story_state(
                request.room_id, {"karma": new_karma}
            )
            updates_made.append(f"karma: {karma_change:+d}")

    # Process NPC reaction markers
    if "npc_reactions" in markers:
        for npc_code, reaction_data in markers["npc_reactions"].items():
            # Get NPC and update relationship
            progress = await db_client.get_room_progress(request.room_id)
            if progress:
                npc = await db_client.get_npc(progress["campaign_id"], npc_code)
                if npc:
                    await redis_client.update_npc_memory(
                        request.room_id,
                        npc_code,
                        {"emotional_state": reaction_data.get("state", "neutral")}
                    )
                    updates_made.append(f"npc:{npc_code}")

    # Process clue reveals
    if "clues_revealed" in markers:
        for clue_code in markers["clues_revealed"]:
            await db_client.update_room_progress(
                request.room_id,
                add_clues=[clue_code]
            )
            updates_made.append(f"clue:{clue_code}")

    # Process decision triggers
    if "decision_triggered" in markers:
        decision_code = markers["decision_triggered"]
        decision = await db_client.get_decision(decision_code)
        if decision:
            pending = {
                "decision_code": decision_code,
                "title": decision["title"],
                "options": decision["options"],
                "turns_remaining": decision.get("timeout_turns", 3),
            }
            await redis_client.set_pending_decision(request.room_id, pending)
            updates_made.append(f"decision:{decision_code}")

    # Invalidate AI context cache
    if updates_made:
        await redis_client.invalidate_ai_context(request.room_id)

    return {
        "status": "ok",
        "updates": updates_made
    }


# ===========================================
# Run Server
# ===========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
