"""
Decision models for critical story choices.
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


class DecisionOption(BaseModel):
    """A single option in a decision."""
    id: str
    label: str
    description: Optional[str] = None
    karma_effect: int = 0
    consequence_flags: List[str] = Field(default_factory=list)
    required_flags: List[str] = Field(default_factory=list)  # Flags needed to see this option
    hidden: bool = False  # Only shown if requirements met


class Decision(BaseModel):
    """A critical story decision."""
    decision_id: int
    decision_code: str
    title: str
    description: Optional[str] = None
    scene_id: int

    options: List[DecisionOption]
    consequences: Dict[str, Any] = Field(default_factory=dict)

    affects_ending: bool = False
    is_hidden: bool = False  # Implicit decision based on behavior
    timeout_turns: Optional[int] = None
    default_option: Optional[str] = None


class PendingDecision(BaseModel):
    """A decision waiting for player response."""
    decision_code: str
    title: str
    available_options: List[DecisionOption]
    turns_remaining: Optional[int] = None
    triggered_by: Optional[str] = None  # What triggered this decision
    context: Optional[str] = None  # Additional context


class DecisionResult(BaseModel):
    """Result of processing a decision."""
    decision_code: str
    chosen_option: str

    # Effects
    karma_change: int = 0
    flags_set: List[str] = Field(default_factory=list)
    flags_removed: List[str] = Field(default_factory=list)

    # Navigation
    new_scene_id: Optional[int] = None
    new_chapter_id: Optional[int] = None
    new_act_id: Optional[int] = None

    # Narrative
    narration_hint: Optional[str] = None  # Hint for AI on how to narrate consequence

    # Side effects
    npc_reactions: Dict[str, int] = Field(default_factory=dict)  # NPC code -> relationship change
    reveals_clues: List[str] = Field(default_factory=list)
    unlocks_side_story: Optional[str] = None

    # Ending impact
    ending_impact: Dict[str, float] = Field(default_factory=dict)  # Ending code -> probability change

    class Config:
        json_schema_extra = {
            "example": {
                "decision_code": "trust_varen",
                "chosen_option": "investigate",
                "karma_change": 5,
                "flags_set": ["suspicious_of_varen", "careful_approach"],
                "npc_reactions": {
                    "varen": -10,
                    "lyra": 5
                },
                "reveals_clues": ["clue_varen_nervous"],
                "narration_hint": "El jugador ha elegido ser cauteloso. Varen lo nota."
            }
        }
