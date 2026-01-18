"""
NPC Brain Service.
Simulates NPC personalities, emotions, and decision-making.
"""

from typing import Optional, List, Dict, Any, Tuple
from models.npc import NPCState, NPCReaction, NPCPersonality, NPCRelationship
from config import NPC_EMOTIONAL_STATES, get_settings

settings = get_settings()


class NPCBrain:
    """
    Simulates NPC personality, emotions, and reactions.
    Determines when NPCs betray, redeem, or change behavior.
    """

    # Reaction modifiers based on personality traits
    TRAIT_REACTION_MODIFIERS = {
        "cunning": {
            "deception": +0.3,  # Respects cunning
            "direct_attack": -0.1,  # Prefers subtlety
        },
        "loyalty": {
            "betrayal": -0.5,  # Hates betrayal
            "kept_promise": +0.3,  # Values loyalty
        },
        "compassion": {
            "helped_innocent": +0.4,
            "cruelty": -0.4,
        },
        "pride": {
            "disrespect": -0.4,
            "flattery": +0.2,
        },
        "cruelty": {
            "mercy": -0.2,  # Sees mercy as weakness
            "ruthless": +0.2,
        },
        "honor": {
            "kept_promise": +0.3,
            "betrayal": -0.4,
            "fair_fight": +0.2,
        },
        "greed": {
            "bribe": +0.3,
            "generous": -0.1,
        },
    }

    # Emotional state transitions
    EMOTIONAL_TRANSITIONS = {
        "neutral": {
            "positive_action": "friendly",
            "negative_action": "suspicious",
            "threat": "fearful",
            "kindness": "grateful",
        },
        "friendly": {
            "positive_action": "friendly",
            "negative_action": "suspicious",
            "betrayal": "hostile",
            "continued_kindness": "grateful",
        },
        "suspicious": {
            "positive_action": "neutral",
            "continued_negative": "hostile",
            "proof_of_innocence": "neutral",
        },
        "hostile": {
            "positive_action": "suspicious",
            "major_kindness": "neutral",
            "continued_aggression": "hostile",
        },
        "grateful": {
            "continued_kindness": "grateful",
            "negative_action": "sad",
            "betrayal": "hostile",
        },
        "fearful": {
            "reassurance": "neutral",
            "continued_threat": "desperate",
            "protection": "grateful",
        },
    }

    def __init__(self):
        """Initialize the NPC Brain."""
        pass

    def calculate_reaction(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        player_action: str,
        action_type: str,
        action_details: Dict[str, Any] = None
    ) -> NPCReaction:
        """
        Calculate how an NPC reacts to a player action.
        """
        action_details = action_details or {}

        # Get base reaction based on action type
        base_relation_change, base_trust_change = self._get_base_reaction(
            action_type, action_details
        )

        # Modify based on personality
        relation_modifier, trust_modifier = self._apply_personality_modifiers(
            npc.personality, action_type, action_details
        )

        # Calculate final changes
        final_relation_change = int(base_relation_change * (1 + relation_modifier))
        final_trust_change = int(base_trust_change * (1 + trust_modifier))

        # Determine new emotional state
        new_emotional_state = self._calculate_emotional_transition(
            relationship.emotional_state,
            action_type,
            final_relation_change
        )

        # Generate dialogue hints
        dialogue_hints = self._generate_dialogue_hints(
            npc, relationship, action_type, new_emotional_state
        )

        # Check for special triggers
        reveals_secret = self._check_secret_reveal(
            npc, relationship, action_type, final_relation_change
        )

        triggers_betrayal = self._check_betrayal_trigger(
            npc, relationship, final_relation_change
        )

        triggers_redemption = self._check_redemption_trigger(
            npc, relationship, final_relation_change
        )

        # Generate behavior notes
        behavior_notes = self._generate_behavior_notes(
            npc, relationship, new_emotional_state, action_type
        )

        # Determine dialogue tone
        dialogue_tone = self._get_dialogue_tone(new_emotional_state, npc.personality)

        return NPCReaction(
            npc_code=npc.code,
            npc_name=npc.name,
            emotional_response=new_emotional_state,
            relationship_change=final_relation_change,
            trust_change=final_trust_change,
            dialogue_tone=dialogue_tone,
            dialogue_hints=dialogue_hints,
            reveals_secret=reveals_secret,
            triggers_betrayal=triggers_betrayal,
            triggers_redemption=triggers_redemption,
            behavior_notes=behavior_notes
        )

    def _get_base_reaction(
        self,
        action_type: str,
        action_details: Dict[str, Any]
    ) -> Tuple[int, int]:
        """Get base relationship and trust changes for an action type."""
        reactions = {
            # Positive actions
            "friendly": (5, 3),
            "helped": (10, 8),
            "gift": (8, 5),
            "defended": (15, 12),
            "saved": (25, 20),
            "trusted": (5, 10),
            "honest": (3, 8),
            "respected": (5, 3),

            # Negative actions
            "hostile": (-5, -5),
            "insulted": (-8, -5),
            "threatened": (-10, -15),
            "attacked": (-20, -25),
            "lied": (-5, -15),
            "stole": (-15, -20),
            "betrayed": (-30, -40),

            # Neutral actions
            "neutral": (0, 0),
            "professional": (1, 2),
            "distant": (-2, -1),

            # Special actions
            "confrontation": (-5, 0),  # Direct but not necessarily hostile
            "seductive": (5, -2),  # Friendly but suspicious of motives
            "deceptive": (0, -10),  # May work but damages trust
        }

        return reactions.get(action_type, (0, 0))

    def _apply_personality_modifiers(
        self,
        personality: NPCPersonality,
        action_type: str,
        action_details: Dict[str, Any]
    ) -> Tuple[float, float]:
        """Apply personality-based modifiers to reaction."""
        relation_modifier = 0.0
        trust_modifier = 0.0

        personality_dict = personality.model_dump()

        for trait, trait_value in personality_dict.items():
            if trait in self.TRAIT_REACTION_MODIFIERS:
                trait_reactions = self.TRAIT_REACTION_MODIFIERS[trait]
                if action_type in trait_reactions:
                    # Scale modifier by trait strength (0-100 -> 0-1)
                    strength = trait_value / 100
                    modifier = trait_reactions[action_type] * strength
                    relation_modifier += modifier
                    trust_modifier += modifier * 0.8

        return relation_modifier, trust_modifier

    def _calculate_emotional_transition(
        self,
        current_state: str,
        action_type: str,
        relation_change: int
    ) -> str:
        """Calculate new emotional state based on action and current state."""
        # Map action types to emotional triggers
        action_to_trigger = {
            "friendly": "positive_action",
            "helped": "positive_action",
            "gift": "positive_action",
            "defended": "major_kindness",
            "saved": "major_kindness",
            "trusted": "positive_action",

            "hostile": "negative_action",
            "insulted": "negative_action",
            "threatened": "threat",
            "attacked": "continued_aggression",
            "lied": "negative_action",
            "betrayed": "betrayal",
        }

        trigger = action_to_trigger.get(action_type)

        if not trigger:
            # Determine trigger from relation change
            if relation_change > 5:
                trigger = "positive_action"
            elif relation_change < -5:
                trigger = "negative_action"
            else:
                return current_state

        # Look up transition
        if current_state in self.EMOTIONAL_TRANSITIONS:
            transitions = self.EMOTIONAL_TRANSITIONS[current_state]
            if trigger in transitions:
                return transitions[trigger]

        return current_state

    def _generate_dialogue_hints(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        action_type: str,
        new_state: str
    ) -> List[str]:
        """Generate dialogue hints based on NPC state."""
        hints = []

        # Emotional state hints
        state_hints = {
            "friendly": ["Sonríe genuinamente", "Tono cálido y acogedor"],
            "suspicious": ["Entrecierra los ojos", "Respuestas cautelosas"],
            "hostile": ["Tono cortante", "Postura defensiva"],
            "grateful": ["Expresión de agradecimiento", "Disposición a ayudar"],
            "fearful": ["Voz temblorosa", "Evita confrontación directa"],
            "nervous": ["Se toca el cuello/manos nerviosamente", "Evita el contacto visual"],
            "calculating": ["Pausa antes de responder", "Elige las palabras con cuidado"],
        }

        if new_state in state_hints:
            hints.extend(state_hints[new_state])

        # Personality-based hints
        personality = npc.personality

        if personality.pride > 70:
            hints.append("Mantiene postura altiva y digna")
        if personality.cunning > 70:
            hints.append("Respuestas con doble sentido o ambiguas")
        if personality.compassion > 70 and action_type in ["helped", "saved"]:
            hints.append("Muestra emoción genuina")

        # Secret-keeper behavior
        if npc.secrets and relationship.trust_level < 60:
            hints.append("Evita ciertos temas o cambia de tema sutilmente")

        return hints

    def _check_secret_reveal(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        action_type: str,
        relation_change: int
    ) -> Optional[str]:
        """Check if NPC should reveal a secret."""
        if not npc.secrets:
            return None

        # Already known secrets
        known = set(relationship.known_secrets)
        unknown = [s for s in npc.secrets if s not in known]

        if not unknown:
            return None

        # High trust + positive interaction can reveal secrets
        new_trust = relationship.trust_level + relation_change

        if new_trust >= 80 and action_type in ["saved", "defended", "trusted"]:
            return unknown[0]

        if new_trust >= 70 and relationship.interactions_count >= 5:
            if action_type in ["friendly", "helped", "honest"]:
                return unknown[0]

        return None

    def _check_betrayal_trigger(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        relation_change: int
    ) -> bool:
        """Check if conditions are met for NPC betrayal."""
        if relationship.betrayal_triggered:
            return False  # Already betrayed

        if not npc.true_role or npc.true_role == npc.apparent_role:
            return False  # Not a secret traitor

        threshold = npc.betrayal_threshold or settings.betrayal_threshold_default
        new_relationship = relationship.relationship_score + relation_change

        # Betray if relationship drops below threshold
        if new_relationship < threshold:
            return True

        return False

    def _check_redemption_trigger(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        relation_change: int
    ) -> bool:
        """Check if conditions are met for NPC redemption."""
        if relationship.redemption_triggered:
            return False  # Already redeemed

        if not npc.true_role or npc.true_role == npc.apparent_role:
            return False  # Not a secret role to redeem from

        threshold = npc.redemption_threshold or settings.redemption_threshold_default
        new_relationship = relationship.relationship_score + relation_change

        # Redeem if relationship exceeds threshold
        if new_relationship >= threshold:
            return True

        return False

    def _generate_behavior_notes(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        emotional_state: str,
        action_type: str
    ) -> List[str]:
        """Generate AI behavior notes for narrating this NPC."""
        notes = []

        # Secret agenda notes (for AI only)
        if npc.true_role and npc.true_role != npc.apparent_role:
            if npc.true_role == "traitor":
                if relationship.relationship_score > 60:
                    notes.append(
                        f"{npc.name} mantiene su fachada pero internamente "
                        "planea cómo usar esta confianza"
                    )
                else:
                    notes.append(
                        f"{npc.name} comienza a ver a los jugadores como "
                        "una amenaza a sus planes"
                    )
            elif npc.true_role == "secret_ally":
                if relationship.trust_level > 50:
                    notes.append(
                        f"{npc.name} considera revelar su verdadera lealtad"
                    )

        # Emotional state guidance
        if emotional_state == "suspicious":
            notes.append("Hace preguntas indirectas para saber más")
        elif emotional_state == "hostile":
            notes.append("Busca excusas para terminar la conversación")
        elif emotional_state == "grateful":
            notes.append("Ofrece información o ayuda voluntariamente")

        return notes

    def _get_dialogue_tone(
        self,
        emotional_state: str,
        personality: NPCPersonality
    ) -> str:
        """Determine dialogue tone based on state and personality."""
        base_tones = {
            "neutral": "formal",
            "friendly": "cálido",
            "suspicious": "cauteloso",
            "hostile": "cortante",
            "grateful": "efusivo",
            "fearful": "tembloroso",
            "nervous": "vacilante",
            "calculating": "medido",
            "angry": "agresivo",
            "sad": "melancólico",
        }

        base_tone = base_tones.get(emotional_state, "neutral")

        # Modify by personality
        if personality.pride > 80:
            if base_tone == "friendly":
                return "cordial pero distante"
            if base_tone == "fearful":
                return "tenso pero digno"

        if personality.cunning > 80:
            if base_tone == "hostile":
                return "amenazante pero sutil"

        return base_tone

    def should_npc_act(
        self,
        npc: NPCState,
        relationship: NPCRelationship,
        story_context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Determine if NPC should take autonomous action.
        Returns action details or None.
        """
        # Check for betrayal execution
        if self._check_betrayal_trigger(npc, relationship, 0):
            return {
                "action": "betray",
                "description": f"{npc.name} decide actuar contra los jugadores",
                "severity": "high"
            }

        # Check for help offer
        if relationship.relationship_score > 80 and relationship.trust_level > 70:
            if story_context.get("danger_level", 0) > 0.5:
                return {
                    "action": "help",
                    "description": f"{npc.name} ofrece ayuda inesperada",
                    "severity": "medium"
                }

        # Check for secret confession
        if relationship.trust_level > 85 and npc.secrets:
            unknown_secrets = [
                s for s in npc.secrets
                if s not in relationship.known_secrets
            ]
            if unknown_secrets:
                return {
                    "action": "confess",
                    "description": f"{npc.name} decide confesar algo importante",
                    "secret": unknown_secrets[0],
                    "severity": "medium"
                }

        return None


# Singleton instance
_npc_brain: Optional[NPCBrain] = None


def get_npc_brain() -> NPCBrain:
    """Get or create NPC brain instance."""
    global _npc_brain
    if _npc_brain is None:
        _npc_brain = NPCBrain()
    return _npc_brain
