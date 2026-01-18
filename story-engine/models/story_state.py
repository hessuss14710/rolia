"""
Story state models for tracking campaign progress.
"""

from datetime import datetime
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


class StoryPosition(BaseModel):
    """Current position in the story structure."""
    campaign_id: int
    campaign_code: str
    act: int = 1
    chapter: int = 1
    scene: int = 1


class SceneContext(BaseModel):
    """Context information for the current scene."""
    scene_id: int
    scene_type: str  # 'narrative', 'combat', 'puzzle', 'social', 'revelation', 'decision'
    title: str
    opening_narration: Optional[str] = None
    ai_context: Optional[str] = None
    ai_secret_instructions: Optional[str] = None
    tension_level: str = "normal"
    victory_conditions: Dict[str, Any] = Field(default_factory=dict)
    failure_conditions: Dict[str, Any] = Field(default_factory=dict)
    branch_triggers: List[Dict[str, Any]] = Field(default_factory=list)

    # Parent context
    chapter_title: Optional[str] = None
    act_title: Optional[str] = None
    campaign_name: Optional[str] = None


class StoryState(BaseModel):
    """Complete story state for a room."""
    room_id: int
    position: StoryPosition
    scene: Optional[SceneContext] = None

    # Progress tracking
    karma: int = 50
    faction_standings: Dict[str, int] = Field(default_factory=dict)
    decisions_made: Dict[str, str] = Field(default_factory=dict)
    story_flags: Dict[str, Any] = Field(default_factory=dict)
    revealed_clues: List[str] = Field(default_factory=list)
    side_stories_completed: List[str] = Field(default_factory=list)

    # Ending tracking
    ending_path: Optional[str] = None
    ending_probabilities: Dict[str, float] = Field(default_factory=dict)

    # Pending decisions
    pending_decision: Optional[str] = None
    pending_decision_turns: Optional[int] = None

    # Active NPCs in current scene
    active_npcs: List[str] = Field(default_factory=list)

    # Timestamps
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class ProgressUpdate(BaseModel):
    """Update to story progress."""
    room_id: int

    # Position changes (optional)
    new_act: Optional[int] = None
    new_chapter: Optional[int] = None
    new_scene: Optional[int] = None

    # State changes
    karma_change: Optional[int] = None
    faction_changes: Optional[Dict[str, int]] = None
    new_flags: Optional[Dict[str, Any]] = None
    new_clues: Optional[List[str]] = None
    decision_made: Optional[Dict[str, str]] = None  # {decision_code: option_chosen}

    # Decision management
    set_pending_decision: Optional[str] = None
    clear_pending_decision: bool = False
    decrement_decision_turns: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "room_id": 1,
                "karma_change": 10,
                "new_flags": {"trusted_varen": True},
                "new_clues": ["clue_medallion"]
            }
        }
