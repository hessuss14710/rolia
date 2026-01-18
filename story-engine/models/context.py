"""
Context models for AI integration.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class NarrativeHint(BaseModel):
    """A narrative hint for the AI."""
    type: str  # 'foreshadow', 'npc_behavior', 'atmosphere', 'secret'
    content: str
    priority: int = 5  # 1-10, higher = more important
    related_to: Optional[str] = None  # NPC code, clue code, etc.


class NPCContextInfo(BaseModel):
    """NPC information for AI context."""
    code: str
    name: str
    apparent_role: str
    description: Optional[str] = None
    dialogue_style: Optional[str] = None
    current_mood: str = "neutral"
    relationship_with_players: int = 50
    trust_level: int = 50

    # Behavior guidance
    secret_agenda: Optional[str] = None  # Hidden goal (for AI only)
    behavior_hints: List[str] = Field(default_factory=list)

    # What players know about this NPC
    known_secrets: List[str] = Field(default_factory=list)


class ContextRequest(BaseModel):
    """Request for AI context."""
    room_id: int
    player_message: Optional[str] = None
    include_npcs: bool = True
    include_hints: bool = True
    include_history_summary: bool = False


class ContextResponse(BaseModel):
    """Full AI context for narrative generation."""
    room_id: int

    # Story position
    campaign_name: str
    campaign_tone: str  # 'dark', 'heroic', 'mystery', etc.
    act_number: int
    act_title: str
    chapter_number: int
    chapter_title: str
    scene_number: int
    scene_title: str
    scene_type: str

    # Scene context
    scene_context: str  # Descriptive context for the scene
    scene_objectives: List[str] = Field(default_factory=list)
    tension_level: str = "normal"

    # NPCs
    active_npcs: List[NPCContextInfo] = Field(default_factory=list)

    # Narrative hints (for AI, not shown to players)
    narrative_hints: List[NarrativeHint] = Field(default_factory=list)

    # Available revelations
    available_clues: List[str] = Field(default_factory=list)  # Clues that can be revealed

    # Player state
    karma: int = 50
    karma_description: str = "neutral"  # 'heroico', 'honorable', 'neutral', 'egoísta', 'villano'
    faction_standings: Dict[str, int] = Field(default_factory=dict)

    # Pending decision
    pending_decision: Optional[Dict[str, Any]] = None

    # Recent decisions summary
    recent_decisions_summary: Optional[str] = None

    # Story so far (brief)
    story_summary: Optional[str] = None

    # Special instructions
    special_instructions: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "room_id": 1,
                "campaign_name": "Las Sombras de Valdoria",
                "campaign_tone": "mystery",
                "act_number": 1,
                "act_title": "El Llamado",
                "chapter_number": 2,
                "chapter_title": "Primeras Pistas",
                "scene_number": 1,
                "scene_title": "La Taberna del Cáliz Roto",
                "scene_type": "social",
                "scene_context": "Los héroes han llegado a la taberna donde el príncipe era visto frecuentemente...",
                "tension_level": "normal",
                "active_npcs": [
                    {
                        "code": "lyra",
                        "name": "Lyra",
                        "apparent_role": "tabernera",
                        "dialogue_style": "amable pero reservada",
                        "current_mood": "cautelosa",
                        "relationship_with_players": 50,
                        "secret_agenda": "Evaluar si puede confiar en los héroes",
                        "behavior_hints": ["Observa atentamente sus reacciones"]
                    }
                ],
                "narrative_hints": [
                    {
                        "type": "foreshadow",
                        "content": "Mencionar que Lyra tiene un anillo similar al del príncipe",
                        "priority": 7
                    }
                ],
                "karma": 55,
                "karma_description": "honorable"
            }
        }


class AIContext(BaseModel):
    """Simplified AI context for system prompt."""
    # Core narrative context
    scene_context: str
    npcs_present: List[Dict[str, Any]]

    # Hidden instructions
    secret_instructions: List[str] = Field(default_factory=list)
    foreshadowing_hints: List[str] = Field(default_factory=list)

    # Player karma context
    karma_context: str

    # Pending decision info
    pending_decision: Optional[Dict[str, Any]] = None

    # Tension and tone
    tension_level: str
    narrative_tone: str

    def to_system_prompt_section(self) -> str:
        """Convert to a formatted section for the AI system prompt."""
        sections = []

        sections.append(f"CONTEXTO DE ESCENA:\n{self.scene_context}")

        if self.npcs_present:
            npc_lines = []
            for npc in self.npcs_present:
                npc_info = f"- {npc['name']} ({npc.get('apparent_role', 'desconocido')})"
                if npc.get('mood'):
                    npc_info += f" - Estado: {npc['mood']}"
                npc_lines.append(npc_info)
            sections.append("NPCs PRESENTES:\n" + "\n".join(npc_lines))

        sections.append(f"TONO NARRATIVO: {self.narrative_tone}")
        sections.append(f"NIVEL DE TENSIÓN: {self.tension_level}")
        sections.append(f"CONTEXTO DE KARMA: {self.karma_context}")

        if self.secret_instructions:
            sections.append(
                "INSTRUCCIONES SECRETAS (NO REVELAR DIRECTAMENTE):\n" +
                "\n".join(f"- {inst}" for inst in self.secret_instructions)
            )

        if self.foreshadowing_hints:
            sections.append(
                "PISTAS A INCLUIR SUTILMENTE:\n" +
                "\n".join(f"- {hint}" for hint in self.foreshadowing_hints)
            )

        if self.pending_decision:
            sections.append(
                f"DECISIÓN PENDIENTE: {self.pending_decision.get('title', 'Sin título')}\n" +
                f"Guía al jugador hacia tomar esta decisión de forma natural."
            )

        return "\n\n".join(sections)
