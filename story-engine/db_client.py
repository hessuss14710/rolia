"""
PostgreSQL database client for Story Engine.
"""

import asyncpg
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from config import get_settings

settings = get_settings()

# Connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db():
    """Initialize database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10
        )
    return _pool


async def close_db():
    """Close database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_connection():
    """Get a database connection from the pool."""
    if _pool is None:
        await init_db()
    async with _pool.acquire() as conn:
        yield conn


# ===========================================
# Campaign Queries
# ===========================================

async def get_campaign(campaign_id: int) -> Optional[Dict[str, Any]]:
    """Get campaign by ID."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, theme_id, name, code, synopsis, tone, difficulty,
                   estimated_sessions, total_acts, is_active, created_at
            FROM campaigns WHERE id = $1
            """,
            campaign_id
        )
        return dict(row) if row else None


async def get_campaign_by_code(code: str) -> Optional[Dict[str, Any]]:
    """Get campaign by code."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, theme_id, name, code, synopsis, tone, difficulty,
                   estimated_sessions, total_acts, is_active, created_at
            FROM campaigns WHERE code = $1 AND is_active = TRUE
            """,
            code
        )
        return dict(row) if row else None


async def list_campaigns(theme_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """List all active campaigns."""
    async with get_connection() as conn:
        if theme_id:
            rows = await conn.fetch(
                """
                SELECT id, theme_id, name, code, synopsis, tone, difficulty,
                       estimated_sessions, total_acts
                FROM campaigns WHERE is_active = TRUE AND theme_id = $1
                ORDER BY name
                """,
                theme_id
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, theme_id, name, code, synopsis, tone, difficulty,
                       estimated_sessions, total_acts
                FROM campaigns WHERE is_active = TRUE
                ORDER BY name
                """
            )
        return [dict(row) for row in rows]


# ===========================================
# Story Structure Queries
# ===========================================

async def get_act(campaign_id: int, act_number: int) -> Optional[Dict[str, Any]]:
    """Get act by campaign and number."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, campaign_id, act_number, title, description,
                   objectives, unlock_conditions, estimated_sessions
            FROM story_acts
            WHERE campaign_id = $1 AND act_number = $2
            """,
            campaign_id, act_number
        )
        return dict(row) if row else None


async def get_chapter(act_id: int, chapter_number: int) -> Optional[Dict[str, Any]]:
    """Get chapter by act and number."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, act_id, chapter_number, title, narrative_hook,
                   key_npcs, locations, possible_branches, is_optional
            FROM story_chapters
            WHERE act_id = $1 AND chapter_number = $2
            """,
            act_id, chapter_number
        )
        return dict(row) if row else None


async def get_scene(chapter_id: int, scene_order: int) -> Optional[Dict[str, Any]]:
    """Get scene by chapter and order."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, chapter_id, scene_order, scene_type, title,
                   opening_narration, ai_context, ai_secret_instructions,
                   victory_conditions, failure_conditions, rewards,
                   next_scene_default, branch_triggers, tension_level
            FROM story_scenes
            WHERE chapter_id = $1 AND scene_order = $2
            """,
            chapter_id, scene_order
        )
        return dict(row) if row else None


async def get_scene_by_id(scene_id: int) -> Optional[Dict[str, Any]]:
    """Get scene by ID."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id, s.chapter_id, s.scene_order, s.scene_type, s.title,
                   s.opening_narration, s.ai_context, s.ai_secret_instructions,
                   s.victory_conditions, s.failure_conditions, s.rewards,
                   s.next_scene_default, s.branch_triggers, s.tension_level,
                   ch.title as chapter_title, a.title as act_title,
                   c.name as campaign_name, c.tone as campaign_tone
            FROM story_scenes s
            JOIN story_chapters ch ON ch.id = s.chapter_id
            JOIN story_acts a ON a.id = ch.act_id
            JOIN campaigns c ON c.id = a.campaign_id
            WHERE s.id = $1
            """,
            scene_id
        )
        return dict(row) if row else None


async def get_current_scene_full(room_id: int) -> Optional[Dict[str, Any]]:
    """Get full current scene details for a room."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.*, ch.title as chapter_title, ch.narrative_hook,
                   a.title as act_title, a.objectives as act_objectives,
                   c.name as campaign_name, c.tone as campaign_tone,
                   c.code as campaign_code
            FROM room_campaign_progress rcp
            JOIN campaigns c ON c.id = rcp.campaign_id
            JOIN story_acts a ON a.campaign_id = c.id AND a.act_number = rcp.current_act
            JOIN story_chapters ch ON ch.act_id = a.id AND ch.chapter_number = rcp.current_chapter
            JOIN story_scenes s ON s.chapter_id = ch.id AND s.scene_order = rcp.current_scene
            WHERE rcp.room_id = $1
            """,
            room_id
        )
        return dict(row) if row else None


# ===========================================
# Decision Queries
# ===========================================

async def get_decision(decision_code: str) -> Optional[Dict[str, Any]]:
    """Get decision by code."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, scene_id, decision_code, title, description,
                   options, consequences, affects_ending, is_hidden,
                   timeout_turns, default_option
            FROM story_decisions
            WHERE decision_code = $1
            """,
            decision_code
        )
        return dict(row) if row else None


async def get_scene_decisions(scene_id: int) -> List[Dict[str, Any]]:
    """Get all decisions for a scene."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, scene_id, decision_code, title, description,
                   options, consequences, affects_ending, is_hidden,
                   timeout_turns, default_option
            FROM story_decisions
            WHERE scene_id = $1
            """,
            scene_id
        )
        return [dict(row) for row in rows]


# ===========================================
# NPC Queries
# ===========================================

async def get_campaign_npcs(campaign_id: int) -> List[Dict[str, Any]]:
    """Get all NPCs for a campaign."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, campaign_id, code, name, apparent_role, true_role,
                   description, appearance, personality, secrets,
                   dialogue_style, relationship_default, betrayal_threshold,
                   redemption_threshold, is_major
            FROM story_npcs
            WHERE campaign_id = $1
            """,
            campaign_id
        )
        return [dict(row) for row in rows]


async def get_npc(campaign_id: int, npc_code: str) -> Optional[Dict[str, Any]]:
    """Get NPC by campaign and code."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, campaign_id, code, name, apparent_role, true_role,
                   description, appearance, personality, secrets,
                   dialogue_style, relationship_default, betrayal_threshold,
                   redemption_threshold, is_major
            FROM story_npcs
            WHERE campaign_id = $1 AND code = $2
            """,
            campaign_id, npc_code
        )
        return dict(row) if row else None


async def get_room_npc_relationship(
    room_id: int, npc_id: int
) -> Optional[Dict[str, Any]]:
    """Get NPC relationship for a room."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, room_id, npc_id, relationship_score, trust_level,
                   known_secrets, interactions_count, last_interaction,
                   emotional_state, betrayal_triggered, redemption_triggered,
                   custom_state
            FROM room_npc_relationships
            WHERE room_id = $1 AND npc_id = $2
            """,
            room_id, npc_id
        )
        return dict(row) if row else None


async def upsert_room_npc_relationship(
    room_id: int,
    npc_id: int,
    relationship_score: Optional[int] = None,
    trust_level: Optional[int] = None,
    emotional_state: Optional[str] = None,
    add_secret: Optional[str] = None,
    increment_interactions: bool = False,
    betrayal_triggered: Optional[bool] = None,
    redemption_triggered: Optional[bool] = None
) -> Dict[str, Any]:
    """Update or insert NPC relationship."""
    async with get_connection() as conn:
        # Build dynamic update
        updates = []
        values = [room_id, npc_id]
        idx = 3

        if relationship_score is not None:
            updates.append(f"relationship_score = ${idx}")
            values.append(relationship_score)
            idx += 1

        if trust_level is not None:
            updates.append(f"trust_level = ${idx}")
            values.append(trust_level)
            idx += 1

        if emotional_state is not None:
            updates.append(f"emotional_state = ${idx}")
            values.append(emotional_state)
            idx += 1

        if add_secret:
            updates.append(f"known_secrets = array_append(known_secrets, ${idx})")
            values.append(add_secret)
            idx += 1

        if increment_interactions:
            updates.append("interactions_count = interactions_count + 1")
            updates.append("last_interaction = NOW()")

        if betrayal_triggered is not None:
            updates.append(f"betrayal_triggered = ${idx}")
            values.append(betrayal_triggered)
            idx += 1

        if redemption_triggered is not None:
            updates.append(f"redemption_triggered = ${idx}")
            values.append(redemption_triggered)
            idx += 1

        updates.append("updated_at = NOW()")

        row = await conn.fetchrow(
            f"""
            INSERT INTO room_npc_relationships (room_id, npc_id)
            VALUES ($1, $2)
            ON CONFLICT (room_id, npc_id) DO UPDATE SET
                {', '.join(updates)}
            RETURNING *
            """,
            *values
        )
        return dict(row)


# ===========================================
# Room Queries
# ===========================================

async def room_exists(room_id: int) -> bool:
    """Check if a room exists in the database."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM rooms WHERE id = $1",
            room_id
        )
        return row is not None


# ===========================================
# Progress Queries
# ===========================================

async def get_room_progress(room_id: int) -> Optional[Dict[str, Any]]:
    """Get room campaign progress."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT rcp.*, c.name as campaign_name, c.code as campaign_code,
                   c.tone as campaign_tone
            FROM room_campaign_progress rcp
            JOIN campaigns c ON c.id = rcp.campaign_id
            WHERE rcp.room_id = $1
            """,
            room_id
        )
        return dict(row) if row else None


async def create_room_progress(
    room_id: int,
    campaign_id: int
) -> Dict[str, Any]:
    """Create initial room progress for a campaign."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO room_campaign_progress (room_id, campaign_id)
            VALUES ($1, $2)
            RETURNING *
            """,
            room_id, campaign_id
        )
        return dict(row)


async def update_room_progress(
    room_id: int,
    current_act: Optional[int] = None,
    current_chapter: Optional[int] = None,
    current_scene: Optional[int] = None,
    karma: Optional[int] = None,
    add_flags: Optional[Dict[str, Any]] = None,
    add_decision: Optional[Dict[str, str]] = None,
    add_clues: Optional[List[str]] = None,
    ending_path: Optional[str] = None,
    pending_decision_code: Optional[str] = None,
    clear_pending_decision: bool = False
) -> Optional[Dict[str, Any]]:
    """Update room progress."""
    async with get_connection() as conn:
        updates = []
        values = [room_id]
        idx = 2

        if current_act is not None:
            updates.append(f"current_act = ${idx}")
            values.append(current_act)
            idx += 1

        if current_chapter is not None:
            updates.append(f"current_chapter = ${idx}")
            values.append(current_chapter)
            idx += 1

        if current_scene is not None:
            updates.append(f"current_scene = ${idx}")
            values.append(current_scene)
            idx += 1

        if karma is not None:
            updates.append(f"karma = ${idx}")
            values.append(max(0, min(100, karma)))  # Clamp 0-100
            idx += 1

        if add_flags:
            updates.append(f"story_flags = story_flags || ${idx}::jsonb")
            values.append(add_flags)
            idx += 1

        if add_decision:
            updates.append(f"decisions_made = decisions_made || ${idx}::jsonb")
            values.append(add_decision)
            idx += 1

        if add_clues:
            for clue in add_clues:
                updates.append(f"revealed_clues = array_append(revealed_clues, ${idx})")
                values.append(clue)
                idx += 1

        if ending_path is not None:
            updates.append(f"ending_path = ${idx}")
            values.append(ending_path)
            idx += 1

        if pending_decision_code is not None:
            updates.append(f"pending_decision_code = ${idx}")
            values.append(pending_decision_code)
            idx += 1
        elif clear_pending_decision:
            updates.append("pending_decision_code = NULL")
            updates.append("pending_decision_turns = NULL")

        if not updates:
            return await get_room_progress(room_id)

        row = await conn.fetchrow(
            f"""
            UPDATE room_campaign_progress
            SET {', '.join(updates)}
            WHERE room_id = $1
            RETURNING *
            """,
            *values
        )
        return dict(row) if row else None


# ===========================================
# Clues Queries
# ===========================================

async def get_campaign_clues(campaign_id: int) -> List[Dict[str, Any]]:
    """Get all clues for a campaign."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, campaign_id, code, title, content,
                   related_twist, foreshadow_hint, is_required
            FROM story_clues
            WHERE campaign_id = $1
            """,
            campaign_id
        )
        return [dict(row) for row in rows]


async def get_clue(campaign_id: int, clue_code: str) -> Optional[Dict[str, Any]]:
    """Get clue by code."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, campaign_id, code, title, content,
                   related_twist, foreshadow_hint, is_required
            FROM story_clues
            WHERE campaign_id = $1 AND code = $2
            """,
            campaign_id, clue_code
        )
        return dict(row) if row else None


# ===========================================
# Endings Queries
# ===========================================

async def get_campaign_endings(campaign_id: int) -> List[Dict[str, Any]]:
    """Get all endings for a campaign."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, campaign_id, code, title, description,
                   narration, requirements, is_good_ending, epilogue
            FROM story_endings
            WHERE campaign_id = $1
            """,
            campaign_id
        )
        return [dict(row) for row in rows]


# ===========================================
# Event Logging
# ===========================================

async def log_story_event(
    room_id: int,
    event_type: str,
    event_data: Dict[str, Any]
) -> int:
    """Log a story event."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO story_events (room_id, event_type, event_data)
            VALUES ($1, $2, $3)
            RETURNING id
            """,
            room_id, event_type, event_data
        )
        return row['id']


async def get_recent_events(
    room_id: int,
    limit: int = 20,
    event_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get recent story events."""
    async with get_connection() as conn:
        if event_type:
            rows = await conn.fetch(
                """
                SELECT id, event_type, event_data, created_at
                FROM story_events
                WHERE room_id = $1 AND event_type = $2
                ORDER BY created_at DESC
                LIMIT $3
                """,
                room_id, event_type, limit
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, event_type, event_data, created_at
                FROM story_events
                WHERE room_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                room_id, limit
            )
        return [dict(row) for row in rows]
