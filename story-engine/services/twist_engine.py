"""
Twist Engine Service.
Manages plot twists, revelations, timing, and foreshadowing.
"""

from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Twist:
    """A plot twist or revelation."""
    twist_id: str
    title: str
    description: str
    revelation_text: str  # Text to reveal when twist happens

    # Requirements
    required_clues: List[str] = field(default_factory=list)
    min_clues_for_reveal: int = 2
    required_flags: List[str] = field(default_factory=list)
    required_act: int = 1  # Minimum act for reveal

    # Foreshadowing
    foreshadowing_elements: List[Dict[str, Any]] = field(default_factory=list)

    # Related content
    related_npcs: List[str] = field(default_factory=list)
    related_decisions: List[str] = field(default_factory=list)

    # Priority and impact
    priority: int = 5  # 1-10, higher = more impactful
    affects_ending: bool = False


@dataclass
class RedHerring:
    """A false clue or misleading element."""
    herring_id: str
    description: str
    false_conclusion: str  # What players might wrongly conclude
    real_truth: str  # The actual truth

    # When to deploy
    deploy_after_clue: Optional[str] = None
    deploy_in_act: Optional[int] = None

    # How it's revealed as false
    revelation_trigger: Optional[str] = None


class TwistEngine:
    """
    Manages plot twists, their timing, foreshadowing, and red herrings.
    """

    def __init__(self):
        """Initialize the twist engine."""
        self.twists: Dict[str, Twist] = {}
        self.red_herrings: Dict[str, RedHerring] = {}
        self.revealed_twists: Set[str] = set()
        self.deployed_herrings: Set[str] = set()
        self.foreshadowed: Dict[str, int] = {}  # twist_id -> count

    def register_twist(self, twist: Twist) -> None:
        """Register a plot twist."""
        self.twists[twist.twist_id] = twist

    def register_red_herring(self, herring: RedHerring) -> None:
        """Register a red herring."""
        self.red_herrings[herring.herring_id] = herring

    def check_revelation_timing(
        self,
        story_state: Dict[str, Any]
    ) -> Optional[Twist]:
        """
        Check if any twist should be revealed based on current state.
        """
        current_act = story_state.get("current_act", 1)
        revealed_clues = set(story_state.get("revealed_clues", []))
        story_flags = story_state.get("story_flags", {})
        tension_level = story_state.get("tension_level", "normal")

        candidates = []

        for twist_id, twist in self.twists.items():
            if twist_id in self.revealed_twists:
                continue

            # Check act requirement
            if current_act < twist.required_act:
                continue

            # Check required flags
            if twist.required_flags:
                if not all(story_flags.get(f) for f in twist.required_flags):
                    continue

            # Check clues
            clues_found = len(set(twist.required_clues) & revealed_clues)
            if clues_found < twist.min_clues_for_reveal:
                continue

            # Calculate readiness score
            readiness = self._calculate_readiness(
                twist, clues_found, story_state, tension_level
            )

            if readiness >= 0.7:  # Threshold for revelation
                candidates.append((twist, readiness))

        if not candidates:
            return None

        # Return highest readiness twist
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]

    def _calculate_readiness(
        self,
        twist: Twist,
        clues_found: int,
        story_state: Dict[str, Any],
        tension_level: str
    ) -> float:
        """Calculate readiness score for a twist reveal."""
        score = 0.0

        # Clue progress (0-0.4)
        if twist.required_clues:
            clue_ratio = clues_found / len(twist.required_clues)
            score += clue_ratio * 0.4
        else:
            score += 0.3

        # Foreshadowing done (0-0.2)
        foreshadow_count = self.foreshadowed.get(twist.twist_id, 0)
        foreshadow_score = min(foreshadow_count / 3, 1.0) * 0.2
        score += foreshadow_score

        # Tension bonus (0-0.2)
        tension_bonuses = {
            "low": 0.0,
            "normal": 0.05,
            "high": 0.15,
            "critical": 0.2,
        }
        score += tension_bonuses.get(tension_level, 0.05)

        # Act progression bonus (0-0.2)
        current_act = story_state.get("current_act", 1)
        if current_act > twist.required_act:
            act_bonus = min((current_act - twist.required_act) * 0.1, 0.2)
            score += act_bonus

        return score

    def generate_foreshadowing(
        self,
        story_state: Dict[str, Any],
        scene_type: str
    ) -> List[Dict[str, Any]]:
        """
        Generate foreshadowing hints for upcoming twists.
        """
        hints = []
        current_act = story_state.get("current_act", 1)
        revealed_clues = set(story_state.get("revealed_clues", []))

        for twist_id, twist in self.twists.items():
            if twist_id in self.revealed_twists:
                continue

            # Only foreshadow twists coming in next 1-2 acts
            if twist.required_act > current_act + 2:
                continue

            # Check foreshadowing elements for this scene type
            for element in twist.foreshadowing_elements:
                if element.get("scene_type") == scene_type or not element.get("scene_type"):
                    # Check if this specific foreshadow already given
                    element_id = f"{twist_id}_{element.get('id', 'default')}"
                    if element_id in self.foreshadowed:
                        continue

                    # Calculate if we should foreshadow now
                    clues_found = len(set(twist.required_clues) & revealed_clues)
                    total_clues = len(twist.required_clues) or 1

                    # More foreshadowing as we approach revelation
                    progress = clues_found / total_clues

                    hint = {
                        "twist_id": twist_id,
                        "hint": element.get("subtle_hint", ""),
                        "priority": int(twist.priority * (0.5 + progress * 0.5)),
                        "npc": element.get("npc"),
                        "type": "foreshadow"
                    }
                    hints.append(hint)

        # Sort by priority and limit
        hints.sort(key=lambda x: x["priority"], reverse=True)
        return hints[:3]  # Max 3 foreshadowing hints per scene

    def record_foreshadowing(self, twist_id: str) -> None:
        """Record that a twist has been foreshadowed."""
        self.foreshadowed[twist_id] = self.foreshadowed.get(twist_id, 0) + 1

    def mark_revealed(self, twist_id: str) -> None:
        """Mark a twist as revealed."""
        self.revealed_twists.add(twist_id)

    def create_red_herring(
        self,
        real_twist: Twist
    ) -> Optional[RedHerring]:
        """
        Generate a red herring based on a real twist.
        """
        if not real_twist.related_npcs:
            return None

        # Create a false suspect
        false_suspect = self._generate_false_suspect(real_twist)
        misleading_clue = self._generate_misleading_clue(real_twist)

        if not false_suspect and not misleading_clue:
            return None

        return RedHerring(
            herring_id=f"herring_{real_twist.twist_id}",
            description=f"Pista falsa relacionada con {real_twist.title}",
            false_conclusion=false_suspect or misleading_clue,
            real_truth=real_twist.revelation_text,
            deploy_after_clue=real_twist.required_clues[0] if real_twist.required_clues else None,
        )

    def _generate_false_suspect(self, twist: Twist) -> Optional[str]:
        """Generate a false suspect for a twist."""
        # This would typically use campaign-specific data
        # For now, return a template
        if twist.related_npcs:
            return f"Las evidencias parecen apuntar a alguien más..."
        return None

    def _generate_misleading_clue(self, twist: Twist) -> Optional[str]:
        """Generate a misleading clue."""
        return f"Una pista que sugiere una conclusión diferente..."

    def check_red_herring_deployment(
        self,
        story_state: Dict[str, Any]
    ) -> List[RedHerring]:
        """Check if any red herrings should be deployed."""
        herrings_to_deploy = []
        revealed_clues = set(story_state.get("revealed_clues", []))
        current_act = story_state.get("current_act", 1)

        for herring_id, herring in self.red_herrings.items():
            if herring_id in self.deployed_herrings:
                continue

            # Check clue trigger
            if herring.deploy_after_clue:
                if herring.deploy_after_clue in revealed_clues:
                    herrings_to_deploy.append(herring)
                    continue

            # Check act trigger
            if herring.deploy_in_act:
                if current_act >= herring.deploy_in_act:
                    herrings_to_deploy.append(herring)

        return herrings_to_deploy

    def mark_herring_deployed(self, herring_id: str) -> None:
        """Mark a red herring as deployed."""
        self.deployed_herrings.add(herring_id)

    def get_revelation_context(self, twist: Twist) -> Dict[str, Any]:
        """Get context for narrating a twist revelation."""
        return {
            "twist_id": twist.twist_id,
            "title": twist.title,
            "revelation_text": twist.revelation_text,
            "related_npcs": twist.related_npcs,
            "impact_level": "high" if twist.affects_ending else "medium",
            "narration_hints": [
                "Crear momento dramático",
                "Referenciar pistas anteriores",
                "Mostrar reacciones de NPCs presentes",
            ]
        }

    def load_campaign_twists(self, campaign_data: Dict[str, Any]) -> None:
        """Load twists from campaign data."""
        for twist_data in campaign_data.get("twists", []):
            twist = Twist(
                twist_id=twist_data["id"],
                title=twist_data["title"],
                description=twist_data.get("description", ""),
                revelation_text=twist_data.get("revelation_text", ""),
                required_clues=twist_data.get("required_clues", []),
                min_clues_for_reveal=twist_data.get("min_clues", 2),
                required_flags=twist_data.get("required_flags", []),
                required_act=twist_data.get("required_act", 1),
                foreshadowing_elements=twist_data.get("foreshadowing", []),
                related_npcs=twist_data.get("related_npcs", []),
                related_decisions=twist_data.get("related_decisions", []),
                priority=twist_data.get("priority", 5),
                affects_ending=twist_data.get("affects_ending", False),
            )
            self.register_twist(twist)

        for herring_data in campaign_data.get("red_herrings", []):
            herring = RedHerring(
                herring_id=herring_data["id"],
                description=herring_data.get("description", ""),
                false_conclusion=herring_data.get("false_conclusion", ""),
                real_truth=herring_data.get("real_truth", ""),
                deploy_after_clue=herring_data.get("deploy_after_clue"),
                deploy_in_act=herring_data.get("deploy_in_act"),
                revelation_trigger=herring_data.get("revelation_trigger"),
            )
            self.register_red_herring(herring)


# Cache for campaign twist engines
_campaign_engines: Dict[int, TwistEngine] = {}


def get_twist_engine(campaign_id: int) -> TwistEngine:
    """Get or create twist engine for a campaign."""
    if campaign_id not in _campaign_engines:
        _campaign_engines[campaign_id] = TwistEngine()
    return _campaign_engines[campaign_id]


def clear_twist_engine(campaign_id: int) -> None:
    """Clear cached twist engine."""
    if campaign_id in _campaign_engines:
        del _campaign_engines[campaign_id]
