"""
Redis client for Story Engine state management.
Provides fast caching for story state, NPC memory, and AI context.
"""

import json
import redis.asyncio as redis
from typing import Optional, Dict, Any, List
from datetime import datetime

from config import get_settings

settings = get_settings()

# Redis client
_redis: Optional[redis.Redis] = None


async def init_redis() -> redis.Redis:
    """Initialize Redis connection."""
    global _redis
    if _redis is None:
        _redis = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
    return _redis


async def close_redis():
    """Close Redis connection."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None


async def get_redis() -> redis.Redis:
    """Get Redis client instance."""
    if _redis is None:
        await init_redis()
    return _redis


# ===========================================
# Key Generators
# ===========================================

def _story_state_key(room_id: int) -> str:
    return f"story:room:{room_id}:state"


def _npc_memory_key(room_id: int, npc_code: str) -> str:
    return f"story:room:{room_id}:npc:{npc_code}"


def _ai_context_key(room_id: int) -> str:
    return f"story:room:{room_id}:ai_context"


def _pending_decision_key(room_id: int) -> str:
    return f"story:room:{room_id}:pending_decision"


def _event_channel_key(room_id: int) -> str:
    return f"story:events:{room_id}"


def _session_lock_key(room_id: int) -> str:
    return f"story:room:{room_id}:lock"


# ===========================================
# Story State Operations
# ===========================================

async def get_story_state(room_id: int) -> Optional[Dict[str, Any]]:
    """Get cached story state for a room."""
    r = await get_redis()
    data = await r.get(_story_state_key(room_id))
    return json.loads(data) if data else None


async def set_story_state(room_id: int, state: Dict[str, Any]) -> None:
    """Set story state with TTL."""
    r = await get_redis()
    state['updated_at'] = datetime.utcnow().isoformat()
    await r.setex(
        _story_state_key(room_id),
        settings.redis_ttl_story_state,
        json.dumps(state)
    )


async def update_story_state(
    room_id: int,
    updates: Dict[str, Any]
) -> Dict[str, Any]:
    """Update specific fields in story state."""
    r = await get_redis()
    state = await get_story_state(room_id) or {}
    state.update(updates)
    state['updated_at'] = datetime.utcnow().isoformat()
    await r.setex(
        _story_state_key(room_id),
        settings.redis_ttl_story_state,
        json.dumps(state)
    )
    return state


async def delete_story_state(room_id: int) -> None:
    """Delete story state."""
    r = await get_redis()
    await r.delete(_story_state_key(room_id))


# ===========================================
# NPC Memory Operations
# ===========================================

async def get_npc_memory(room_id: int, npc_code: str) -> Optional[Dict[str, Any]]:
    """Get NPC memory for a room."""
    r = await get_redis()
    data = await r.get(_npc_memory_key(room_id, npc_code))
    return json.loads(data) if data else None


async def set_npc_memory(
    room_id: int,
    npc_code: str,
    memory: Dict[str, Any]
) -> None:
    """Set NPC memory with TTL."""
    r = await get_redis()
    memory['last_updated'] = datetime.utcnow().isoformat()
    await r.setex(
        _npc_memory_key(room_id, npc_code),
        settings.redis_ttl_npc_memory,
        json.dumps(memory)
    )


async def update_npc_memory(
    room_id: int,
    npc_code: str,
    updates: Dict[str, Any]
) -> Dict[str, Any]:
    """Update NPC memory fields."""
    memory = await get_npc_memory(room_id, npc_code) or {}
    memory.update(updates)
    await set_npc_memory(room_id, npc_code, memory)
    return memory


async def add_npc_interaction(
    room_id: int,
    npc_code: str,
    action_type: str,
    details: str
) -> None:
    """Add an interaction to NPC memory."""
    memory = await get_npc_memory(room_id, npc_code) or {
        "interactions": [],
        "relationship": settings.default_relationship,
        "trust": 50,
        "emotional_state": "neutral"
    }

    interaction = {
        "timestamp": datetime.utcnow().isoformat(),
        "action_type": action_type,
        "details": details
    }

    if "interactions" not in memory:
        memory["interactions"] = []

    # Keep last 20 interactions
    memory["interactions"].append(interaction)
    memory["interactions"] = memory["interactions"][-20:]

    await set_npc_memory(room_id, npc_code, memory)


async def get_all_npc_memories(room_id: int) -> Dict[str, Dict[str, Any]]:
    """Get all NPC memories for a room."""
    r = await get_redis()
    pattern = f"story:room:{room_id}:npc:*"
    memories = {}

    async for key in r.scan_iter(pattern):
        npc_code = key.split(":")[-1]
        data = await r.get(key)
        if data:
            memories[npc_code] = json.loads(data)

    return memories


# ===========================================
# AI Context Cache
# ===========================================

async def get_cached_ai_context(room_id: int) -> Optional[Dict[str, Any]]:
    """Get cached AI context."""
    r = await get_redis()
    data = await r.get(_ai_context_key(room_id))
    return json.loads(data) if data else None


async def set_cached_ai_context(
    room_id: int,
    context: Dict[str, Any]
) -> None:
    """Cache AI context with short TTL."""
    r = await get_redis()
    await r.setex(
        _ai_context_key(room_id),
        settings.redis_ttl_ai_context,
        json.dumps(context)
    )


async def invalidate_ai_context(room_id: int) -> None:
    """Invalidate cached AI context."""
    r = await get_redis()
    await r.delete(_ai_context_key(room_id))


# ===========================================
# Pending Decision Operations
# ===========================================

async def get_pending_decision(room_id: int) -> Optional[Dict[str, Any]]:
    """Get pending decision for a room."""
    r = await get_redis()
    data = await r.get(_pending_decision_key(room_id))
    return json.loads(data) if data else None


async def set_pending_decision(
    room_id: int,
    decision: Dict[str, Any]
) -> None:
    """Set pending decision."""
    r = await get_redis()
    decision['set_at'] = datetime.utcnow().isoformat()
    await r.setex(
        _pending_decision_key(room_id),
        settings.redis_ttl_story_state,  # Same TTL as story state
        json.dumps(decision)
    )


async def clear_pending_decision(room_id: int) -> None:
    """Clear pending decision."""
    r = await get_redis()
    await r.delete(_pending_decision_key(room_id))


async def decrement_decision_turns(room_id: int) -> Optional[int]:
    """Decrement turns remaining for pending decision."""
    decision = await get_pending_decision(room_id)
    if decision and decision.get('turns_remaining'):
        decision['turns_remaining'] -= 1
        if decision['turns_remaining'] <= 0:
            await clear_pending_decision(room_id)
            return 0
        await set_pending_decision(room_id, decision)
        return decision['turns_remaining']
    return None


# ===========================================
# Session Lock (for critical decisions)
# ===========================================

async def acquire_session_lock(
    room_id: int,
    lock_id: str,
    ttl: int = 30
) -> bool:
    """Acquire a session lock to prevent race conditions."""
    r = await get_redis()
    return await r.set(
        _session_lock_key(room_id),
        lock_id,
        nx=True,  # Only set if not exists
        ex=ttl
    )


async def release_session_lock(room_id: int, lock_id: str) -> bool:
    """Release session lock if we own it."""
    r = await get_redis()
    current = await r.get(_session_lock_key(room_id))
    if current == lock_id:
        await r.delete(_session_lock_key(room_id))
        return True
    return False


async def check_session_lock(room_id: int) -> bool:
    """Check if session is locked."""
    r = await get_redis()
    return await r.exists(_session_lock_key(room_id)) > 0


# ===========================================
# Pub/Sub for Real-time Events
# ===========================================

async def publish_story_event(
    room_id: int,
    event_type: str,
    data: Dict[str, Any]
) -> None:
    """Publish a story event to the room channel."""
    r = await get_redis()
    event = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await r.publish(_event_channel_key(room_id), json.dumps(event))


async def subscribe_to_room(room_id: int):
    """Subscribe to room events. Returns async iterator."""
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(_event_channel_key(room_id))
    return pubsub


# ===========================================
# Karma Leaderboard
# ===========================================

async def update_karma_leaderboard(
    campaign_id: int,
    room_id: int,
    karma: int
) -> None:
    """Update karma leaderboard for a campaign."""
    r = await get_redis()
    await r.zadd(
        f"story:campaign:{campaign_id}:karma_leaderboard",
        {str(room_id): karma}
    )


async def get_karma_leaderboard(
    campaign_id: int,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """Get top karma scores for a campaign."""
    r = await get_redis()
    results = await r.zrevrange(
        f"story:campaign:{campaign_id}:karma_leaderboard",
        0, limit - 1,
        withscores=True
    )
    return [
        {"room_id": int(room_id), "karma": int(karma)}
        for room_id, karma in results
    ]


# ===========================================
# Utility Functions
# ===========================================

async def cleanup_room_data(room_id: int) -> None:
    """Clean up all Redis data for a room."""
    r = await get_redis()

    # Delete story state
    await r.delete(_story_state_key(room_id))

    # Delete AI context
    await r.delete(_ai_context_key(room_id))

    # Delete pending decision
    await r.delete(_pending_decision_key(room_id))

    # Delete session lock
    await r.delete(_session_lock_key(room_id))

    # Delete NPC memories
    pattern = f"story:room:{room_id}:npc:*"
    async for key in r.scan_iter(pattern):
        await r.delete(key)


async def health_check() -> bool:
    """Check Redis connection health."""
    try:
        r = await get_redis()
        await r.ping()
        return True
    except Exception:
        return False
