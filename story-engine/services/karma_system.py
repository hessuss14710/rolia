"""
Karma System Service.
Tracks player morality and faction standings.
"""

from typing import Optional, List, Dict, Any, Tuple
from config import KARMA_ACTIONS, FACTION_THRESHOLDS, get_settings

settings = get_settings()


class KarmaSystem:
    """
    Tracks and manages karma (morality) and faction standings.
    Affects: available dialogues, potential allies, accessible endings.
    """

    # Karma level descriptions
    KARMA_LEVELS = {
        (90, 100): ("heroico", "Leyenda viviente, símbolo de esperanza"),
        (70, 89): ("honorable", "Respetado defensor del bien"),
        (50, 69): ("neutral", "Pragmático, ni héroe ni villano"),
        (30, 49): ("dudoso", "Cuestionable, motivos sospechosos"),
        (10, 29): ("infame", "Temido y despreciado"),
        (0, 9): ("villano", "Encarnación de la maldad"),
    }

    def __init__(self):
        """Initialize the karma system."""
        pass

    def get_karma_level(self, karma: int) -> Tuple[str, str]:
        """Get karma level name and description."""
        karma = max(0, min(100, karma))

        for (low, high), (name, desc) in self.KARMA_LEVELS.items():
            if low <= karma <= high:
                return name, desc

        return "neutral", "Estado desconocido"

    def calculate_karma_change(
        self,
        action_code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> int:
        """Calculate karma change for an action."""
        base_change = KARMA_ACTIONS.get(action_code, 0)

        if not context:
            return base_change

        # Context modifiers
        modifiers = 1.0

        # Repeat offender penalty/bonus
        if context.get("repeated_action"):
            if base_change < 0:
                modifiers *= 1.2  # Worse for repeating bad actions
            else:
                modifiers *= 0.8  # Less reward for same good action

        # Witnesses affect reputation
        if context.get("witnessed"):
            modifiers *= 1.3  # More impact when witnessed

        # Target importance
        if context.get("target_important"):
            modifiers *= 1.5

        return int(base_change * modifiers)

    def apply_karma_change(
        self,
        current_karma: int,
        change: int
    ) -> Tuple[int, bool]:
        """
        Apply karma change and return new value and whether level changed.
        """
        old_level, _ = self.get_karma_level(current_karma)
        new_karma = max(0, min(100, current_karma + change))
        new_level, _ = self.get_karma_level(new_karma)

        level_changed = old_level != new_level

        return new_karma, level_changed

    def get_karma_context_for_ai(self, karma: int) -> str:
        """Generate karma context description for AI."""
        level, description = self.get_karma_level(karma)

        contexts = {
            "heroico": (
                "El grupo es conocido como héroes legendarios. "
                "La gente los reconoce, los ayuda voluntariamente, "
                "y los enemigos los temen. Los NPCs ofrecen información "
                "y ayuda sin pedirla."
            ),
            "honorable": (
                "El grupo tiene buena reputación. La gente confía en ellos "
                "y está dispuesta a ayudar. Los comerciantes ofrecen descuentos "
                "y los guardias son cordiales."
            ),
            "neutral": (
                "El grupo es relativamente desconocido o tiene reputación mixta. "
                "La gente los trata con cautela normal. Deben ganarse la confianza "
                "de cada NPC individualmente."
            ),
            "dudoso": (
                "El grupo tiene mala fama. La gente desconfía de ellos, "
                "los precios son más altos, y los guardias los vigilan. "
                "Algunos NPCs se niegan a hablar con ellos."
            ),
            "infame": (
                "El grupo es temido y odiado. Los ciudadanos huyen o llaman "
                "a los guardias. Solo criminales y villanos tratan con ellos. "
                "Hay recompensas por su captura en algunas zonas."
            ),
            "villano": (
                "El grupo es considerado una amenaza pública. Son cazados "
                "activamente, ningún NPC decente les ayudará, y solo los más "
                "depravados se asocian con ellos."
            ),
        }

        return contexts.get(level, contexts["neutral"])

    def update_faction_standing(
        self,
        current_standings: Dict[str, int],
        faction: str,
        change: int,
        action_context: Optional[str] = None
    ) -> Tuple[Dict[str, int], List[str]]:
        """
        Update faction standing and return new standings plus triggered events.
        """
        events = []
        new_standings = current_standings.copy()

        old_value = new_standings.get(faction, 50)
        new_value = max(0, min(100, old_value + change))
        new_standings[faction] = new_value

        # Check threshold crossings
        if faction in FACTION_THRESHOLDS:
            thresholds = FACTION_THRESHOLDS[faction]

            # Trust threshold
            if "trust_threshold" in thresholds:
                threshold = thresholds["trust_threshold"]
                if old_value < threshold <= new_value:
                    events.append(f"{faction}_trust_gained")
                elif old_value >= threshold > new_value:
                    events.append(f"{faction}_trust_lost")

            # Betray threshold
            if "betray_threshold" in thresholds:
                threshold = thresholds["betray_threshold"]
                if old_value >= threshold > new_value:
                    events.append(f"{faction}_turned_hostile")

            # Hero threshold
            if "hero_threshold" in thresholds:
                threshold = thresholds["hero_threshold"]
                if old_value < threshold <= new_value:
                    events.append(f"{faction}_hero_status")

            # Villain threshold
            if "villain_threshold" in thresholds:
                threshold = thresholds["villain_threshold"]
                if old_value >= threshold > new_value:
                    events.append(f"{faction}_villain_status")

            # Recruit threshold (for enemy factions)
            if "recruit_threshold" in thresholds:
                threshold = thresholds["recruit_threshold"]
                if old_value > threshold >= new_value:
                    events.append(f"{faction}_recruitment_attempt")

        # Handle faction relationships (opposing factions)
        faction_relations = {
            "corona": {"orden_llama": -0.5},
            "orden_llama": {"corona": -0.3, "pueblo": -0.2},
            "rebeldes": {"corona": -0.3},
        }

        if faction in faction_relations:
            for related_faction, ratio in faction_relations[faction].items():
                if related_faction in new_standings:
                    related_change = int(change * ratio)
                    new_standings[related_faction] = max(0, min(100,
                        new_standings[related_faction] + related_change
                    ))

        return new_standings, events

    def get_faction_context_for_ai(
        self,
        faction_standings: Dict[str, int]
    ) -> Dict[str, str]:
        """Generate faction standing descriptions for AI."""
        contexts = {}

        for faction, standing in faction_standings.items():
            if standing >= 80:
                status = "aliado"
                desc = "confían plenamente"
            elif standing >= 60:
                status = "favorable"
                desc = "son amigables"
            elif standing >= 40:
                status = "neutral"
                desc = "son cautelosos"
            elif standing >= 20:
                status = "desfavorable"
                desc = "desconfían"
            else:
                status = "hostil"
                desc = "son enemigos"

            contexts[faction] = f"{status} ({desc})"

        return contexts

    def check_ending_karma_requirements(
        self,
        karma: int,
        faction_standings: Dict[str, int],
        ending_requirements: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """Check if karma/faction requirements for an ending are met."""
        met = True
        missing = []

        # Karma requirements
        if "karma_min" in ending_requirements:
            if karma < ending_requirements["karma_min"]:
                met = False
                missing.append(f"karma mínimo {ending_requirements['karma_min']}")

        if "karma_max" in ending_requirements:
            if karma > ending_requirements["karma_max"]:
                met = False
                missing.append(f"karma máximo {ending_requirements['karma_max']}")

        # Faction requirements
        if "faction_requirements" in ending_requirements:
            for faction, req in ending_requirements["faction_requirements"].items():
                current = faction_standings.get(faction, 50)

                if "min" in req and current < req["min"]:
                    met = False
                    missing.append(f"{faction} mínimo {req['min']}")

                if "max" in req and current > req["max"]:
                    met = False
                    missing.append(f"{faction} máximo {req['max']}")

        return met, missing

    def get_available_dialogue_options(
        self,
        karma: int,
        faction_standings: Dict[str, int],
        all_options: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Filter dialogue options based on karma and faction standings."""
        available = []

        for option in all_options:
            requirements = option.get("requirements", {})

            # Check karma
            karma_ok = True
            if "karma_min" in requirements:
                karma_ok = karma >= requirements["karma_min"]
            if karma_ok and "karma_max" in requirements:
                karma_ok = karma <= requirements["karma_max"]

            if not karma_ok:
                continue

            # Check faction
            faction_ok = True
            if "faction" in requirements:
                faction = requirements["faction"]
                required_standing = requirements.get("faction_min", 50)
                current_standing = faction_standings.get(faction, 50)
                faction_ok = current_standing >= required_standing

            if faction_ok:
                available.append(option)

        return available

    def suggest_karma_recovery_actions(
        self,
        current_karma: int,
        target_level: str = "neutral"
    ) -> List[str]:
        """Suggest actions to recover karma to a target level."""
        target_ranges = {
            "heroico": 90,
            "honorable": 70,
            "neutral": 50,
        }

        target_karma = target_ranges.get(target_level, 50)
        difference = target_karma - current_karma

        if difference <= 0:
            return ["El karma ya está en el nivel deseado o superior"]

        suggestions = []

        # Find positive karma actions
        positive_actions = [
            (action, value) for action, value in KARMA_ACTIONS.items()
            if value > 0
        ]
        positive_actions.sort(key=lambda x: x[1], reverse=True)

        accumulated = 0
        for action, value in positive_actions:
            if accumulated < difference:
                action_names = {
                    "helped_innocent": "Ayudar a inocentes",
                    "showed_mercy": "Mostrar misericordia",
                    "kept_promise": "Cumplir promesas",
                    "donated_to_poor": "Donar a los necesitados",
                    "exposed_corruption": "Exponer corrupción",
                    "saved_life": "Salvar vidas",
                    "protected_weak": "Proteger a los débiles",
                }
                suggestions.append(action_names.get(action, action))
                accumulated += value

        return suggestions


# Singleton instance
_karma_system: Optional[KarmaSystem] = None


def get_karma_system() -> KarmaSystem:
    """Get or create karma system instance."""
    global _karma_system
    if _karma_system is None:
        _karma_system = KarmaSystem()
    return _karma_system
