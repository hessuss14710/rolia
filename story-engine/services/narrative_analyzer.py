"""
Narrative Analyzer Service.
Analyzes player actions to detect intent, classify actions, and evaluate coherence.
"""

import re
from typing import Optional, List, Dict, Any, Tuple
from models.action import (
    PlayerAction,
    ActionAnalysis,
    ActionType,
    MoralAlignment,
    KarmaChange,
)
from config import KARMA_ACTIONS


class NarrativeAnalyzer:
    """
    Analyzes player messages to extract intent, classify actions,
    and determine narrative effects.
    """

    # Action type patterns (Spanish)
    ACTION_PATTERNS = {
        ActionType.DIALOGUE: [
            r'\b(hablo|pregunto|digo|le digo|respondo|converso|menciono|susurro|grito)\b',
            r'\b(hablar|preguntar|decir|responder|conversar|mencionar)\b',
            r'^".*"$',  # Quoted speech
        ],
        ActionType.COMBAT: [
            r'\b(ataco|golpeo|disparo|lanzo|peleo|lucho|defiendo)\b',
            r'\b(atacar|golpear|disparar|lanzar|pelear|luchar|defender)\b',
            r'\b(espada|arco|hacha|daga|magia ofensiva)\b',
        ],
        ActionType.STEALTH: [
            r'\b(me escondo|me oculto|sigilosamente|en las sombras|sin ser visto)\b',
            r'\b(esconder|ocultar|sigilo|sombras|infiltrar)\b',
            r'\b(robo|hurto|pickpocket)\b',
        ],
        ActionType.EXPLORATION: [
            r'\b(exploro|examino|inspecciono|busco|miro|observo|registro)\b',
            r'\b(explorar|examinar|inspeccionar|buscar|mirar|observar)\b',
            r'\b(habitación|cuarto|lugar|zona|área)\b',
        ],
        ActionType.INVESTIGATION: [
            r'\b(investigo|analizo|estudio|descifro|leo)\b',
            r'\b(investigar|analizar|estudiar|descifrar|leer)\b',
            r'\b(pista|evidencia|prueba|documento|carta)\b',
        ],
        ActionType.SOCIAL: [
            r'\b(persuado|intimido|engaño|seduzco|negocio|convenzo)\b',
            r'\b(persuadir|intimidar|engañar|seducir|negociar|convencer)\b',
        ],
        ActionType.MAGIC: [
            r'\b(lanzo un hechizo|uso magia|conjuro|invoco|canalizo)\b',
            r'\b(hechizo|magia|conjuro|invocación|ritual)\b',
        ],
        ActionType.ITEM_USE: [
            r'\b(uso|utilizo|aplico|bebo|como|equipo)\b.*\b(poción|objeto|item|arma|armadura)\b',
            r'\b(saco|tomo|agarro|cojo)\b.*\b(de mi|del|de la)\b',
        ],
        ActionType.REST: [
            r'\b(descanso|duermo|espero|me siento|acampo)\b',
            r'\b(descansar|dormir|esperar|sentarse|acampar)\b',
        ],
        ActionType.TRAVEL: [
            r'\b(voy|camino|viajo|me dirijo|corro|huyo)\b',
            r'\b(ir|caminar|viajar|dirigirse|correr|huir)\b',
            r'\b(hacia|hasta|al|a la|norte|sur|este|oeste)\b',
        ],
    }

    # Moral alignment patterns
    MORAL_PATTERNS = {
        MoralAlignment.HEROIC: [
            r'\b(salvo|protejo|defiendo|ayudo|sacrifico)\b',
            r'\b(inocente|débil|indefenso|necesitado)\b',
            r'\b(justicia|honor|verdad|bien)\b',
        ],
        MoralAlignment.GOOD: [
            r'\b(ayudo|comparto|dono|perdono|curo)\b',
            r'\b(amable|gentil|generoso|compasivo)\b',
        ],
        MoralAlignment.SELFISH: [
            r'\b(robo|engaño|miento|oculto|escondo)\b',
            r'\b(para mí|beneficio propio|mi ganancia)\b',
            r'\b(soborno|chantaje|extorsión)\b',
        ],
        MoralAlignment.VILLAINOUS: [
            r'\b(mato|asesino|torturo|destruyo|traiciono)\b',
            r'\b(inocente|indefenso|desarmado)\b',
            r'\b(crueldad|maldad|venganza ciega)\b',
        ],
    }

    # Karma action patterns
    KARMA_PATTERNS = {
        "helped_innocent": [
            r'\b(ayudo|salvo|protejo|defiendo)\b.*\b(inocente|civil|niño|anciano|débil)\b',
        ],
        "showed_mercy": [
            r'\b(perdono|dejo ir|muestro piedad|no mato)\b',
            r'\b(misericordia|clemencia|compasión)\b',
        ],
        "kept_promise": [
            r'\b(cumplo|mantengo)\b.*\b(promesa|palabra|juramento)\b',
        ],
        "donated_to_poor": [
            r'\b(dono|doy|regalo|comparto)\b.*\b(pobre|necesitado|mendigo)\b',
            r'\b(caridad|limosna)\b',
        ],
        "lied_for_gain": [
            r'\b(miento|engaño)\b.*\b(para|conseguir|obtener|beneficio)\b',
        ],
        "stole": [
            r'\b(robo|hurto|me llevo)\b.*\b(sin|que no)\b',
        ],
        "killed_unarmed": [
            r'\b(mato|asesino)\b.*\b(desarmado|indefenso|rendido)\b',
        ],
        "betrayed_ally": [
            r'\b(traiciono|abandono|vendo)\b.*\b(aliado|compañero|amigo)\b',
        ],
        "broke_promise": [
            r'\b(rompo|incumplo)\b.*\b(promesa|palabra|juramento)\b',
        ],
    }

    # NPC interaction patterns
    NPC_INTERACTION_PATTERNS = {
        "friendly": [
            r'\b(amablemente|cortésmente|con respeto|sonrío)\b',
        ],
        "hostile": [
            r'\b(amenaz|intimi|agresi|hostil|con desprecio)\b',
        ],
        "deceptive": [
            r'\b(miento|engaño|oculto la verdad|disimulo)\b',
        ],
        "confrontation": [
            r'\b(confronto|acuso|encaro|exijo)\b',
        ],
        "seductive": [
            r'\b(seduz|coquete|encant|atraigo)\b',
        ],
        "professional": [
            r'\b(formalmente|profesionalmente|negocios)\b',
        ],
    }

    def __init__(self):
        """Initialize the analyzer."""
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        self._action_compiled = {
            action_type: [re.compile(p, re.IGNORECASE) for p in patterns]
            for action_type, patterns in self.ACTION_PATTERNS.items()
        }
        self._moral_compiled = {
            alignment: [re.compile(p, re.IGNORECASE) for p in patterns]
            for alignment, patterns in self.MORAL_PATTERNS.items()
        }
        self._karma_compiled = {
            action: [re.compile(p, re.IGNORECASE) for p in patterns]
            for action, patterns in self.KARMA_PATTERNS.items()
        }
        self._npc_compiled = {
            interaction: [re.compile(p, re.IGNORECASE) for p in patterns]
            for interaction, patterns in self.NPC_INTERACTION_PATTERNS.items()
        }

    def analyze(self, action: PlayerAction) -> ActionAnalysis:
        """
        Analyze a player action and return comprehensive analysis.
        """
        message = action.message.lower().strip()

        # Classify action type
        action_type, type_confidence = self._classify_action_type(message)

        # Determine moral alignment
        alignment, alignment_confidence = self._classify_moral_alignment(message)

        # Detect karma actions
        karma_actions = self._detect_karma_actions(message)

        # Detect target NPC
        target_npc = self._detect_target_npc(message, action.active_npcs)

        # Detect NPC interactions
        npc_interactions = self._detect_npc_interactions(message, action.active_npcs)

        # Detect intent
        intent = self._detect_intent(message, action_type)

        # Calculate coherence with scene
        coherence, coherence_notes = self._evaluate_coherence(
            action_type, action.current_scene_type
        )

        # Check for decision triggers
        decision_trigger = self._check_decision_triggers(message)

        # Combined confidence
        confidence = (type_confidence + alignment_confidence) / 2

        return ActionAnalysis(
            original_message=action.message,
            action_type=action_type,
            moral_alignment=alignment,
            confidence=confidence,
            target_npc=target_npc,
            detected_intent=intent,
            karma_actions=karma_actions,
            total_karma_change=sum(k.amount for k in karma_actions),
            triggers_decision=decision_trigger,
            npc_interactions=npc_interactions,
            coherence_score=coherence,
            coherence_notes=coherence_notes,
        )

    def _classify_action_type(self, message: str) -> Tuple[ActionType, float]:
        """Classify the type of action."""
        scores = {}

        for action_type, patterns in self._action_compiled.items():
            matches = sum(1 for p in patterns if p.search(message))
            if matches > 0:
                scores[action_type] = matches / len(patterns)

        if not scores:
            return ActionType.NEUTRAL, 0.5

        best_type = max(scores, key=scores.get)
        confidence = min(scores[best_type] * 2, 1.0)  # Scale up but cap at 1

        return best_type, confidence

    def _classify_moral_alignment(self, message: str) -> Tuple[MoralAlignment, float]:
        """Classify the moral alignment of the action."""
        scores = {}

        for alignment, patterns in self._moral_compiled.items():
            matches = sum(1 for p in patterns if p.search(message))
            if matches > 0:
                scores[alignment] = matches

        if not scores:
            return MoralAlignment.NEUTRAL, 0.8

        best_alignment = max(scores, key=scores.get)
        confidence = min(scores[best_alignment] * 0.3 + 0.5, 1.0)

        return best_alignment, confidence

    def _detect_karma_actions(self, message: str) -> List[KarmaChange]:
        """Detect karma-affecting actions."""
        karma_changes = []

        for action_code, patterns in self._karma_compiled.items():
            for pattern in patterns:
                if pattern.search(message):
                    amount = KARMA_ACTIONS.get(action_code, 0)
                    karma_changes.append(KarmaChange(
                        action_code=action_code,
                        amount=amount,
                        reason=f"Acción detectada: {action_code}"
                    ))
                    break  # One match per action code

        return karma_changes

    def _detect_target_npc(
        self,
        message: str,
        active_npcs: List[str]
    ) -> Optional[str]:
        """Detect which NPC the action is targeting."""
        message_lower = message.lower()

        for npc_code in active_npcs:
            # Check if NPC name/code appears in message
            if npc_code.lower() in message_lower:
                return npc_code

            # Common patterns for addressing NPCs
            patterns = [
                rf'\ba {npc_code}\b',
                rf'\bcon {npc_code}\b',
                rf'\ba l[ao]s? {npc_code}\b',
                rf'\bel/la {npc_code}\b',
            ]
            for pattern in patterns:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    return npc_code

        return None

    def _detect_npc_interactions(
        self,
        message: str,
        active_npcs: List[str]
    ) -> Dict[str, str]:
        """Detect how player is interacting with NPCs."""
        interactions = {}
        target = self._detect_target_npc(message, active_npcs)

        if not target:
            return interactions

        for interaction_type, patterns in self._npc_compiled.items():
            for pattern in patterns:
                if pattern.search(message):
                    interactions[target] = interaction_type
                    break

        # Default to neutral interaction if NPC targeted but no specific type
        if target and target not in interactions:
            interactions[target] = "neutral"

        return interactions

    def _detect_intent(self, message: str, action_type: ActionType) -> Optional[str]:
        """Detect the player's intent."""
        intent_patterns = {
            "interrogate": r'\b(pregunt[oa]|interrog|cuestion)\b',
            "persuade": r'\b(convenc|persuad|negoci)\b',
            "threaten": r'\b(amenaz|intimi|adviert)\b',
            "gather_info": r'\b(averig|descubr|investig|busc)\b.*\b(información|pistas|verdad)\b',
            "help": r'\b(ayud|asist|socorr)\b',
            "attack": r'\b(atac|golpe|luch|pele)\b',
            "hide": r'\b(escond|ocult|escondi)\b',
            "observe": r'\b(observ|mir|examin|estudi)\b',
            "negotiate": r'\b(negoci|trat|acuerd|pacta)\b',
            "deceive": r'\b(engañ|ment|fals)\b',
        }

        for intent, pattern in intent_patterns.items():
            if re.search(pattern, message, re.IGNORECASE):
                return intent

        # Default intents based on action type
        default_intents = {
            ActionType.DIALOGUE: "communicate",
            ActionType.COMBAT: "attack",
            ActionType.STEALTH: "hide",
            ActionType.EXPLORATION: "explore",
            ActionType.INVESTIGATION: "gather_info",
        }

        return default_intents.get(action_type)

    def _evaluate_coherence(
        self,
        action_type: ActionType,
        scene_type: Optional[str]
    ) -> Tuple[float, List[str]]:
        """Evaluate how well the action fits the current scene."""
        if not scene_type:
            return 1.0, []

        # Define expected action types per scene type
        scene_expected_actions = {
            "narrative": [ActionType.DIALOGUE, ActionType.EXPLORATION],
            "combat": [ActionType.COMBAT, ActionType.MAGIC],
            "puzzle": [ActionType.INVESTIGATION, ActionType.ITEM_USE],
            "social": [ActionType.DIALOGUE, ActionType.SOCIAL],
            "revelation": [ActionType.DIALOGUE, ActionType.INVESTIGATION],
            "decision": [ActionType.DIALOGUE, ActionType.DECISION],
        }

        expected = scene_expected_actions.get(scene_type, [])
        notes = []

        if action_type in expected:
            return 1.0, ["Acción coherente con la escena"]

        # Some actions are always acceptable
        always_acceptable = [ActionType.DIALOGUE, ActionType.NEUTRAL]
        if action_type in always_acceptable:
            return 0.9, ["Acción generalmente aceptable"]

        # Combat during non-combat scene
        if action_type == ActionType.COMBAT and scene_type != "combat":
            notes.append("Acción de combate en escena no combativa - puede escalar la situación")
            return 0.6, notes

        # Stealth in social situation
        if action_type == ActionType.STEALTH and scene_type == "social":
            notes.append("Intento de sigilo en situación social - puede parecer sospechoso")
            return 0.7, notes

        return 0.8, ["Acción no típica para esta escena pero posible"]

    def _check_decision_triggers(self, message: str) -> Optional[str]:
        """Check if message triggers any decision points."""
        # These would be more specifically defined per campaign
        # For now, detect common decision-triggering patterns
        trigger_patterns = {
            "confrontation": r'\b(acuso|confronto|encaro|exijo saber)\b',
            "alliance": r'\b(me uno|acepto|hago trato|alianza)\b',
            "betrayal": r'\b(traiciono|vendo|revelo secreto)\b',
            "trust": r'\b(confío|creo|le doy)\b.*\b(en|a)\b',
            "refuse": r'\b(rechazo|me niego|no acepto)\b',
        }

        for trigger_type, pattern in trigger_patterns.items():
            if re.search(pattern, message, re.IGNORECASE):
                return f"trigger_{trigger_type}"

        return None

    def detect_emotion(self, message: str) -> Optional[str]:
        """Detect character emotion from message."""
        emotion_patterns = {
            "angry": r'\b(furioso|enfadado|rabioso|ira|grito)\b',
            "sad": r'\b(triste|apenado|llorando|melancolía)\b',
            "happy": r'\b(feliz|alegre|sonriente|contento)\b',
            "fearful": r'\b(miedo|asustado|temeroso|temblando)\b',
            "suspicious": r'\b(sospecho|desconfío|recelo)\b',
            "confident": r'\b(seguro|confiado|decidido)\b',
            "curious": r'\b(curioso|intrigado|interesado)\b',
        }

        for emotion, pattern in emotion_patterns.items():
            if re.search(pattern, message, re.IGNORECASE):
                return emotion

        return None


# Singleton instance
_analyzer: Optional[NarrativeAnalyzer] = None


def get_analyzer() -> NarrativeAnalyzer:
    """Get or create analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = NarrativeAnalyzer()
    return _analyzer
