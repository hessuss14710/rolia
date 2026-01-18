"""
Action models for player action analysis.
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ActionType(str, Enum):
    """Types of player actions."""
    DIALOGUE = "dialogue"  # Talking to NPCs
    EXPLORATION = "exploration"  # Exploring locations
    COMBAT = "combat"  # Fighting
    STEALTH = "stealth"  # Sneaking, hiding
    SOCIAL = "social"  # Persuasion, intimidation
    INVESTIGATION = "investigation"  # Looking for clues
    ITEM_USE = "item_use"  # Using inventory items
    SKILL_CHECK = "skill_check"  # Attempting skill-based action
    DECISION = "decision"  # Making a choice
    REST = "rest"  # Resting, waiting
    TRAVEL = "travel"  # Moving between locations
    MAGIC = "magic"  # Using magic/special abilities
    NEUTRAL = "neutral"  # General/unclear action


class MoralAlignment(str, Enum):
    """Moral alignment of actions."""
    HEROIC = "heroic"
    GOOD = "good"
    NEUTRAL = "neutral"
    SELFISH = "selfish"
    VILLAINOUS = "villainous"


class KarmaChange(BaseModel):
    """A karma modification."""
    action_code: str
    amount: int
    reason: str


class PlayerAction(BaseModel):
    """A player's action/message."""
    room_id: int
    user_id: int
    username: str
    message: str
    character_name: Optional[str] = None
    character_class: Optional[str] = None

    # Context
    current_scene_type: Optional[str] = None
    active_npcs: List[str] = Field(default_factory=list)


class ActionAnalysis(BaseModel):
    """Analysis of a player action."""
    original_message: str

    # Classification
    action_type: ActionType = ActionType.NEUTRAL
    moral_alignment: MoralAlignment = MoralAlignment.NEUTRAL
    confidence: float = 0.5  # 0-1 confidence in classification

    # Detected elements
    target_npc: Optional[str] = None  # NPC being addressed/affected
    detected_intent: Optional[str] = None  # What player is trying to do
    detected_emotion: Optional[str] = None  # Player character's emotion

    # Karma
    karma_actions: List[KarmaChange] = Field(default_factory=list)
    total_karma_change: int = 0

    # Triggers
    triggers_decision: Optional[str] = None  # Decision code if triggered
    triggers_reveal: Optional[str] = None  # Clue code if revealed
    triggers_event: Optional[str] = None  # Special event triggered

    # NPC effects
    npc_interactions: Dict[str, str] = Field(default_factory=dict)  # NPC code -> interaction type

    # Flags
    suggested_flags: List[str] = Field(default_factory=list)

    # Narrative coherence
    coherence_score: float = 1.0  # 0-1, how well action fits current scene
    coherence_notes: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "original_message": "Le pregunto a Lord Varen sobre el medallón que encontramos",
                "action_type": "dialogue",
                "moral_alignment": "neutral",
                "confidence": 0.85,
                "target_npc": "varen",
                "detected_intent": "interrogate",
                "triggers_decision": "trust_varen_confrontation",
                "npc_interactions": {
                    "varen": "confrontation"
                },
                "coherence_score": 0.95,
                "coherence_notes": ["Acción coherente con la escena de investigación"]
            }
        }
