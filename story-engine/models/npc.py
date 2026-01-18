"""
NPC models for personality and relationship tracking.
"""

from datetime import datetime
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


class NPCPersonality(BaseModel):
    """NPC personality traits."""
    cunning: int = 50
    loyalty: int = 50
    patience: int = 50
    pride: int = 50
    cruelty: int = 50
    compassion: int = 50
    courage: int = 50
    greed: int = 50
    honor: int = 50
    wisdom: int = 50


class NPCState(BaseModel):
    """Complete NPC state."""
    npc_id: int
    code: str
    name: str
    apparent_role: str  # What players see
    true_role: Optional[str] = None  # Hidden role for reveals
    description: Optional[str] = None
    appearance: Optional[str] = None
    personality: NPCPersonality = Field(default_factory=NPCPersonality)
    secrets: List[str] = Field(default_factory=list)
    dialogue_style: Optional[str] = None

    # Thresholds
    betrayal_threshold: Optional[int] = None
    redemption_threshold: Optional[int] = None

    # Flags
    is_major: bool = False


class NPCRelationship(BaseModel):
    """Per-room NPC relationship state."""
    room_id: int
    npc_id: int
    npc_code: str
    npc_name: str

    # Scores
    relationship_score: int = 50  # 0-100
    trust_level: int = 50  # 0-100

    # Knowledge
    known_secrets: List[str] = Field(default_factory=list)

    # Interaction tracking
    interactions_count: int = 0
    last_interaction: Optional[datetime] = None

    # State
    emotional_state: str = "neutral"
    betrayal_triggered: bool = False
    redemption_triggered: bool = False
    custom_state: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class NPCReaction(BaseModel):
    """Calculated NPC reaction to player action."""
    npc_code: str
    npc_name: str

    # Reaction components
    emotional_response: str  # New emotional state
    relationship_change: int = 0  # Change to relationship score
    trust_change: int = 0  # Change to trust level

    # Dialogue guidance
    dialogue_tone: str = "neutral"  # How NPC should speak
    dialogue_hints: List[str] = Field(default_factory=list)  # Specific things to say/avoid

    # Special triggers
    reveals_secret: Optional[str] = None  # Secret to reveal if any
    triggers_betrayal: bool = False
    triggers_redemption: bool = False

    # Behavior guidance for AI
    behavior_notes: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "npc_code": "varen",
                "npc_name": "Lord Varen",
                "emotional_response": "suspicious",
                "relationship_change": -5,
                "trust_change": -10,
                "dialogue_tone": "guarded",
                "dialogue_hints": [
                    "Evita contacto visual",
                    "Cambia de tema rápidamente",
                    "Se toca nerviosamente el cuello"
                ],
                "behavior_notes": [
                    "Varen está preocupado de que sospechen de él",
                    "Intentará desviar la atención hacia otros"
                ]
            }
        }
