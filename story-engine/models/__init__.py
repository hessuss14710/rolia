"""
Pydantic models for Story Engine.
"""

from .story_state import (
    StoryState,
    SceneContext,
    ProgressUpdate,
    StoryPosition,
)
from .npc import (
    NPCState,
    NPCReaction,
    NPCPersonality,
    NPCRelationship,
)
from .decision import (
    Decision,
    DecisionOption,
    DecisionResult,
    PendingDecision,
)
from .action import (
    PlayerAction,
    ActionAnalysis,
    ActionType,
    KarmaChange,
)
from .context import (
    AIContext,
    NarrativeHint,
    ContextRequest,
    ContextResponse,
)

__all__ = [
    # Story State
    "StoryState",
    "SceneContext",
    "ProgressUpdate",
    "StoryPosition",
    # NPC
    "NPCState",
    "NPCReaction",
    "NPCPersonality",
    "NPCRelationship",
    # Decision
    "Decision",
    "DecisionOption",
    "DecisionResult",
    "PendingDecision",
    # Action
    "PlayerAction",
    "ActionAnalysis",
    "ActionType",
    "KarmaChange",
    # Context
    "AIContext",
    "NarrativeHint",
    "ContextRequest",
    "ContextResponse",
]
