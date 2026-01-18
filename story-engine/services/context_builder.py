"""
Context Builder Service.
Builds enriched context for AI narrative generation.
"""

from typing import Optional, List, Dict, Any
from models.context import (
    ContextRequest,
    ContextResponse,
    AIContext,
    NarrativeHint,
    NPCContextInfo,
)
from models.story_state import StoryState, SceneContext
from services.karma_system import get_karma_system
from services.twist_engine import get_twist_engine
from services.npc_brain import get_npc_brain
import db_client
import redis_client


class ContextBuilder:
    """
    Builds comprehensive context for AI narrative generation.
    Combines story state, NPC info, hints, and secret instructions.
    """

    def __init__(self):
        """Initialize the context builder."""
        self.karma_system = get_karma_system()
        self.npc_brain = get_npc_brain()

    async def build_context(
        self,
        request: ContextRequest
    ) -> ContextResponse:
        """
        Build full context response for AI.
        """
        room_id = request.room_id

        # Get story state from Redis (fast) or DB (fallback)
        story_state = await redis_client.get_story_state(room_id)
        if not story_state:
            db_progress = await db_client.get_room_progress(room_id)
            if not db_progress:
                raise ValueError(f"No campaign progress found for room {room_id}")
            story_state = self._progress_to_state(db_progress)

        # Get current scene details
        scene_data = await db_client.get_current_scene_full(room_id)
        if not scene_data:
            raise ValueError(f"Could not load current scene for room {room_id}")

        # Get campaign info
        campaign_id = story_state.get("campaign_id")

        # Build NPC context if requested
        npcs_context = []
        if request.include_npcs:
            npcs_context = await self._build_npc_context(
                room_id, campaign_id, scene_data
            )

        # Build narrative hints if requested
        hints = []
        if request.include_hints:
            hints = await self._build_narrative_hints(
                room_id, campaign_id, story_state, scene_data
            )

        # Get karma description
        karma = story_state.get("karma", 50)
        karma_level, karma_desc = self.karma_system.get_karma_level(karma)

        # Get pending decision
        pending_decision = await redis_client.get_pending_decision(room_id)

        # Build history summary if requested
        story_summary = None
        if request.include_history_summary:
            story_summary = await self._build_story_summary(room_id, story_state)

        # Get available clues that can be revealed
        available_clues = await self._get_available_clues(
            campaign_id, story_state
        )

        # Get faction standings
        faction_standings = story_state.get("faction_standings", {})

        return ContextResponse(
            room_id=room_id,
            campaign_name=scene_data.get("campaign_name", ""),
            campaign_tone=scene_data.get("campaign_tone", "heroic"),
            act_number=story_state.get("current_act", 1),
            act_title=scene_data.get("act_title", ""),
            chapter_number=story_state.get("current_chapter", 1),
            chapter_title=scene_data.get("chapter_title", ""),
            scene_number=story_state.get("current_scene", 1),
            scene_title=scene_data.get("title", ""),
            scene_type=scene_data.get("scene_type", "narrative"),
            scene_context=self._build_scene_context(scene_data),
            scene_objectives=scene_data.get("act_objectives", []),
            tension_level=scene_data.get("tension_level", "normal"),
            active_npcs=npcs_context,
            narrative_hints=hints,
            available_clues=available_clues,
            karma=karma,
            karma_description=karma_level,
            faction_standings=faction_standings,
            pending_decision=pending_decision,
            story_summary=story_summary,
            special_instructions=self._get_special_instructions(scene_data, story_state),
        )

    def _progress_to_state(self, progress: Dict[str, Any]) -> Dict[str, Any]:
        """Convert DB progress to state dict."""
        return {
            "campaign_id": progress.get("campaign_id"),
            "current_act": progress.get("current_act", 1),
            "current_chapter": progress.get("current_chapter", 1),
            "current_scene": progress.get("current_scene", 1),
            "karma": progress.get("karma", 50),
            "faction_standings": progress.get("faction_standings", {}),
            "decisions_made": progress.get("decisions_made", {}),
            "story_flags": progress.get("story_flags", {}),
            "revealed_clues": progress.get("revealed_clues", []),
        }

    def _build_scene_context(self, scene_data: Dict[str, Any]) -> str:
        """Build descriptive scene context."""
        parts = []

        if scene_data.get("opening_narration"):
            parts.append(scene_data["opening_narration"])

        if scene_data.get("ai_context"):
            parts.append(scene_data["ai_context"])

        if scene_data.get("narrative_hook"):
            parts.append(f"Gancho narrativo: {scene_data['narrative_hook']}")

        return "\n\n".join(parts) if parts else "Sin contexto específico de escena."

    async def _build_npc_context(
        self,
        room_id: int,
        campaign_id: int,
        scene_data: Dict[str, Any]
    ) -> List[NPCContextInfo]:
        """Build NPC context information."""
        npcs_context = []

        # Get NPCs mentioned in scene
        key_npcs = scene_data.get("key_npcs", [])
        if not key_npcs:
            return npcs_context

        # Get NPC memories from Redis
        npc_memories = await redis_client.get_all_npc_memories(room_id)

        for npc_ref in key_npcs:
            npc_code = npc_ref if isinstance(npc_ref, str) else npc_ref.get("code")
            if not npc_code:
                continue

            # Get NPC from database
            npc_data = await db_client.get_npc(campaign_id, npc_code)
            if not npc_data:
                continue

            # Get relationship from DB
            npc_id = npc_data.get("id")
            relationship = await db_client.get_room_npc_relationship(room_id, npc_id)

            # Get memory from Redis
            memory = npc_memories.get(npc_code, {})

            # Build NPC context
            npc_context = NPCContextInfo(
                code=npc_code,
                name=npc_data.get("name", npc_code),
                apparent_role=npc_data.get("apparent_role", "unknown"),
                description=npc_data.get("description"),
                dialogue_style=npc_data.get("dialogue_style"),
                current_mood=memory.get("emotional_state", "neutral"),
                relationship_with_players=relationship.get("relationship_score", 50) if relationship else 50,
                trust_level=relationship.get("trust_level", 50) if relationship else 50,
                secret_agenda=self._get_npc_secret_agenda(npc_data),
                behavior_hints=self._get_npc_behavior_hints(npc_data, relationship, memory),
                known_secrets=relationship.get("known_secrets", []) if relationship else [],
            )
            npcs_context.append(npc_context)

        return npcs_context

    def _get_npc_secret_agenda(self, npc_data: Dict[str, Any]) -> Optional[str]:
        """Get NPC's secret agenda for AI."""
        true_role = npc_data.get("true_role")
        apparent_role = npc_data.get("apparent_role")

        if not true_role or true_role == apparent_role:
            return None

        agendas = {
            "traitor": "Secretamente trabaja contra los jugadores, busca ganarse su confianza para usarla después",
            "secret_ally": "Secretamente está de su lado, pero no puede revelarlo aún",
            "spy": "Recopila información sobre los jugadores para alguien más",
            "manipulator": "Intenta dirigir a los jugadores hacia sus propios objetivos",
        }

        return agendas.get(true_role)

    def _get_npc_behavior_hints(
        self,
        npc_data: Dict[str, Any],
        relationship: Optional[Dict[str, Any]],
        memory: Dict[str, Any]
    ) -> List[str]:
        """Generate behavior hints for NPC."""
        hints = []

        # Based on personality
        personality = npc_data.get("personality", {})

        if personality.get("cunning", 50) > 70:
            hints.append("Responde con ambigüedad, nunca da información directa")

        if personality.get("pride", 50) > 70:
            hints.append("Se ofende fácilmente ante falta de respeto")

        if personality.get("compassion", 50) > 70:
            hints.append("Muestra preocupación genuina por los demás")

        # Based on relationship
        if relationship:
            score = relationship.get("relationship_score", 50)
            trust = relationship.get("trust_level", 50)

            if score < 30:
                hints.append("Hostil, respuestas cortantes y desconfiadas")
            elif score > 70:
                hints.append("Amigable, dispuesto a ayudar")

            if trust < 30:
                hints.append("Oculta información importante")
            elif trust > 70:
                hints.append("Puede compartir información sensible")

        # Based on recent memory
        interactions = memory.get("interactions", [])
        if interactions:
            last_interaction = interactions[-1]
            if last_interaction.get("action_type") == "hostile":
                hints.append("Recuerda el último encuentro hostil, está en guardia")

        return hints

    async def _build_narrative_hints(
        self,
        room_id: int,
        campaign_id: int,
        story_state: Dict[str, Any],
        scene_data: Dict[str, Any]
    ) -> List[NarrativeHint]:
        """Build narrative hints for AI."""
        hints = []

        # Get secret instructions from scene
        if scene_data.get("ai_secret_instructions"):
            hints.append(NarrativeHint(
                type="secret",
                content=scene_data["ai_secret_instructions"],
                priority=10,
            ))

        # Get foreshadowing from twist engine
        twist_engine = get_twist_engine(campaign_id)
        foreshadowing = twist_engine.generate_foreshadowing(
            story_state,
            scene_data.get("scene_type", "narrative")
        )

        for foreshadow in foreshadowing:
            hints.append(NarrativeHint(
                type="foreshadow",
                content=foreshadow.get("hint", ""),
                priority=foreshadow.get("priority", 5),
                related_to=foreshadow.get("npc"),
            ))

        # Add tension-appropriate hints
        tension = scene_data.get("tension_level", "normal")
        tension_hints = {
            "low": "Mantén un ritmo relajado, permite exploración",
            "normal": "Balance entre acción y narrativa",
            "high": "Aumenta la urgencia, las consecuencias se sienten cercanas",
            "critical": "Cada acción puede ser decisiva, describe con intensidad dramática",
        }
        if tension in tension_hints:
            hints.append(NarrativeHint(
                type="atmosphere",
                content=tension_hints[tension],
                priority=7,
            ))

        # Sort by priority
        hints.sort(key=lambda h: h.priority, reverse=True)

        return hints

    async def _get_available_clues(
        self,
        campaign_id: int,
        story_state: Dict[str, Any]
    ) -> List[str]:
        """Get clues that can be revealed in current scene."""
        revealed = set(story_state.get("revealed_clues", []))
        all_clues = await db_client.get_campaign_clues(campaign_id)

        available = []
        for clue in all_clues:
            if clue["code"] not in revealed:
                available.append(clue["code"])

        return available

    async def _build_story_summary(
        self,
        room_id: int,
        story_state: Dict[str, Any]
    ) -> str:
        """Build a summary of story progress so far."""
        parts = []

        # Decisions made
        decisions = story_state.get("decisions_made", {})
        if decisions:
            parts.append("Decisiones tomadas:")
            for code, option in list(decisions.items())[-5:]:  # Last 5
                parts.append(f"  - {code}: {option}")

        # Key events
        events = await db_client.get_recent_events(
            room_id, limit=10, event_type="decision_made"
        )
        if events:
            parts.append("\nEventos recientes:")
            for event in events[:5]:
                data = event.get("event_data", {})
                parts.append(f"  - {data.get('description', 'Evento')}")

        # Current standing
        karma = story_state.get("karma", 50)
        level, _ = self.karma_system.get_karma_level(karma)
        parts.append(f"\nReputación actual: {level} (karma: {karma})")

        return "\n".join(parts) if parts else None

    def _get_special_instructions(
        self,
        scene_data: Dict[str, Any],
        story_state: Dict[str, Any]
    ) -> List[str]:
        """Get special AI instructions based on state."""
        instructions = []

        # Scene type specific instructions
        scene_type = scene_data.get("scene_type", "narrative")

        scene_instructions = {
            "combat": [
                "Describe acciones de combate de forma dinámica",
                "Pide tiradas de dados para acciones importantes",
                "Los enemigos reaccionan tácticamente",
            ],
            "puzzle": [
                "Da pistas graduales, no la solución directa",
                "Recompensa el pensamiento creativo",
            ],
            "social": [
                "Los NPCs responden según su personalidad",
                "Las palabras tienen consecuencias",
                "Detecta intentos de persuasión/engaño",
            ],
            "revelation": [
                "Construye tensión antes de revelar",
                "Permite que los jugadores lleguen a conclusiones",
            ],
            "decision": [
                "Presenta opciones de forma natural",
                "No fuerces una decisión específica",
                "Cada opción tiene consecuencias",
            ],
        }

        instructions.extend(scene_instructions.get(scene_type, []))

        # Pending decision instruction
        if story_state.get("pending_decision"):
            instructions.append(
                "Hay una decisión pendiente - guía la narrativa hacia ella"
            )

        return instructions

    async def build_ai_context(
        self,
        room_id: int
    ) -> AIContext:
        """Build simplified AI context for system prompt."""
        # Try cache first
        cached = await redis_client.get_cached_ai_context(room_id)
        if cached:
            return AIContext(**cached)

        # Build full context
        request = ContextRequest(
            room_id=room_id,
            include_npcs=True,
            include_hints=True,
            include_history_summary=False,
        )

        full_context = await self.build_context(request)

        # Simplify for AI
        npcs_present = [
            {
                "name": npc.name,
                "apparent_role": npc.apparent_role,
                "mood": npc.current_mood,
                "secret_agenda": npc.secret_agenda,
            }
            for npc in full_context.active_npcs
        ]

        secret_instructions = [
            h.content for h in full_context.narrative_hints
            if h.type == "secret"
        ]

        foreshadowing = [
            h.content for h in full_context.narrative_hints
            if h.type == "foreshadow"
        ]

        karma_context = self.karma_system.get_karma_context_for_ai(
            full_context.karma
        )

        ai_context = AIContext(
            scene_context=full_context.scene_context,
            npcs_present=npcs_present,
            secret_instructions=secret_instructions,
            foreshadowing_hints=foreshadowing,
            karma_context=karma_context,
            pending_decision=full_context.pending_decision,
            tension_level=full_context.tension_level,
            narrative_tone=full_context.campaign_tone,
        )

        # Cache for 5 minutes
        await redis_client.set_cached_ai_context(room_id, ai_context.model_dump())

        return ai_context


# Singleton instance
_context_builder: Optional[ContextBuilder] = None


def get_context_builder() -> ContextBuilder:
    """Get or create context builder instance."""
    global _context_builder
    if _context_builder is None:
        _context_builder = ContextBuilder()
    return _context_builder
