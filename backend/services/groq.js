const Groq = require('groq-sdk');
const storyEngine = require('./storyEngine');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Parse story markers from AI response.
 * Extended markers for the story system.
 */
function parseStoryMarkers(responseText) {
  const markers = {
    karma: null,
    npcReactions: {},
    cluesRevealed: [],
    decisionTriggered: null,
    sceneTransition: null
  };

  // Extract karma change: [KARMA: +/-N]
  const karmaMatch = responseText.match(/\[KARMA:\s*([+-]\d+)\]/i);
  if (karmaMatch) {
    markers.karma = parseInt(karmaMatch[1], 10);
  }

  // Extract NPC reactions: [NPC_REACT: npc_code:state:reason]
  const npcMatches = responseText.matchAll(/\[NPC_REACT:\s*(\w+):(\w+)(?::([^\]]+))?\]/gi);
  for (const match of npcMatches) {
    markers.npcReactions[match[1]] = {
      state: match[2],
      reason: match[3] || null
    };
  }

  // Extract clue reveals: [CLUE_REVEALED: clue_code]
  const clueMatches = responseText.matchAll(/\[CLUE_REVEALED:\s*(\w+)\]/gi);
  for (const match of clueMatches) {
    markers.cluesRevealed.push(match[1]);
  }

  // Extract decision triggers: [DECISION: decision_code]
  const decisionMatch = responseText.match(/\[DECISION:\s*(\w+)(?::(\w+))?\]/i);
  if (decisionMatch) {
    markers.decisionTriggered = decisionMatch[1];
  }

  // Extract scene transitions: [SCENE: next/act/chapter]
  const sceneMatch = responseText.match(/\[SCENE:\s*(\w+)\]/i);
  if (sceneMatch) {
    markers.sceneTransition = sceneMatch[1];
  }

  return markers;
}

/**
 * Clean story markers from response text.
 */
function cleanStoryMarkers(text) {
  return text
    .replace(/\[KARMA:.*?\]/gi, '')
    .replace(/\[NPC_REACT:.*?\]/gi, '')
    .replace(/\[CLUE_REVEALED:.*?\]/gi, '')
    .replace(/\[DECISION:.*?\]/gi, '')
    .replace(/\[SCENE:.*?\]/gi, '')
    .replace(/\[TENSION:.*?\]/gi, '')
    .trim();
}

/**
 * Build story-enhanced system prompt.
 */
function buildStorySystemPrompt(basePrompt, storyContext) {
  let prompt = basePrompt || 'Eres un narrador de rol experto.';

  prompt += `\n\n## Instrucciones adicionales:
- Responde siempre en español
- Mantén las respuestas concisas pero inmersivas (máximo 3-4 párrafos)
- Si el jugador intenta una acción que requiere tirada de dados, indica qué dado tirar y la dificultad
- Usa el formato [TIRADA: XdY+Z vs DC] cuando propongas tiradas
- Si el resultado de una tirada afecta al personaje (daño, curación), indica [HP: -X] o [HP: +X]
- Para añadir items al inventario usa [ITEM: +nombre]
- Para quitar items usa [ITEM: -nombre]
- Nunca reveles que eres una IA, mantén el rol de narrador misterioso`;

  // Add story system markers if we have story context
  if (storyContext) {
    prompt += `

## Marcadores de Sistema de Historia (usa cuando corresponda):
- [KARMA: +/-N] - Cuando el jugador hace algo heroico (+) o villano (-)
- [NPC_REACT: npc_code:estado] - Para indicar cambio emocional de NPC (ej: [NPC_REACT: varen:suspicious])
- [CLUE_REVEALED: clue_code] - Cuando se revela información importante de la trama
- [DECISION: decision_code] - Cuando el jugador llega a un punto de decisión crítica`;

    // Add story context from Story Engine
    if (storyContext.formatted) {
      prompt += `\n\n${storyContext.formatted}`;
    } else if (storyContext.context) {
      const ctx = storyContext.context;

      prompt += `\n\n## CONTEXTO NARRATIVO ACTUAL:`;

      if (ctx.scene_context) {
        prompt += `\n\nESCENA: ${ctx.scene_context}`;
      }

      if (ctx.npcs_present && ctx.npcs_present.length > 0) {
        prompt += `\n\nNPCs PRESENTES:`;
        for (const npc of ctx.npcs_present) {
          prompt += `\n- ${npc.name} (${npc.apparent_role})`;
          if (npc.mood) prompt += ` - Estado: ${npc.mood}`;
          if (npc.secret_agenda) {
            prompt += `\n  [SECRETO - NO REVELAR DIRECTAMENTE]: ${npc.secret_agenda}`;
          }
        }
      }

      if (ctx.tension_level) {
        prompt += `\n\nNIVEL DE TENSIÓN: ${ctx.tension_level}`;
      }

      if (ctx.narrative_tone) {
        prompt += `\nTONO NARRATIVO: ${ctx.narrative_tone}`;
      }

      if (ctx.karma_context) {
        prompt += `\n\nREPUTACIÓN DEL GRUPO: ${ctx.karma_context}`;
      }

      if (ctx.secret_instructions && ctx.secret_instructions.length > 0) {
        prompt += `\n\nINSTRUCCIONES SECRETAS (NO REVELAR):`;
        for (const inst of ctx.secret_instructions) {
          prompt += `\n- ${inst}`;
        }
      }

      if (ctx.foreshadowing_hints && ctx.foreshadowing_hints.length > 0) {
        prompt += `\n\nPISTAS A INCLUIR SUTILMENTE:`;
        for (const hint of ctx.foreshadowing_hints) {
          prompt += `\n- ${hint}`;
        }
      }

      if (ctx.pending_decision) {
        prompt += `\n\nDECISIÓN PENDIENTE: ${ctx.pending_decision.title || 'Sin título'}
Guía naturalmente al jugador hacia tomar esta decisión.`;
      }
    }
  }

  return prompt;
}

async function generateResponse({ systemPrompt, gameContext, recentHistory, userMessage, character, username, roomId }) {
  // Try to get story context from Story Engine
  let storyContext = null;

  if (roomId) {
    try {
      storyContext = await storyEngine.getAIContext(roomId);
    } catch (err) {
      console.error('Failed to get story context:', err.message);
    }
  }

  // Build enhanced system prompt
  let contextMessage = buildStorySystemPrompt(systemPrompt, storyContext);

  if (gameContext) {
    contextMessage += `\n\n## Contexto adicional de la partida:\n${gameContext}`;
  }

  if (character) {
    contextMessage += `\n\n## Personaje del jugador (${username}):
- Nombre: ${character.name}
- Clase: ${character.class}
- Nivel: ${character.level}
- HP: ${character.hp}/${character.max_hp}
- Estadísticas: ${JSON.stringify(character.stats)}
- Inventario: ${JSON.stringify(character.inventory || [])}`;

    if (character.background) {
      contextMessage += `\n- Trasfondo: ${character.background}`;
    }
  }

  // Build messages array
  const messages = [
    { role: 'system', content: contextMessage }
  ];

  // Add recent history
  if (recentHistory && recentHistory.length > 0) {
    for (const entry of recentHistory) {
      if (entry.speaker === 'ia') {
        messages.push({ role: 'assistant', content: entry.message });
      } else {
        messages.push({ role: 'user', content: entry.message });
      }
    }
  }

  // Add current message
  messages.push({
    role: 'user',
    content: `[${username}${character ? ` como ${character.name}` : ''}]: ${userMessage}`
  });

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages,
      temperature: 0.8,
      max_tokens: 1024,
      top_p: 0.9
    });

    const responseText = completion.choices[0]?.message?.content || 'El narrador permanece en silencio...';

    // Parse all markers
    const storyMarkers = parseStoryMarkers(responseText);

    // Parse original markers (dice, HP, items)
    const result = {
      text: cleanStoryMarkers(
        responseText
          .replace(/\[TIRADA:.*?\]/g, '')
          .replace(/\[HP:.*?\]/g, '')
          .replace(/\[ITEM:.*?\]/g, '')
      ).trim(),
      diceRoll: null,
      characterUpdate: null,
      updatedContext: null,
      storyMarkers
    };

    // Extract dice roll suggestion
    const diceMatch = responseText.match(/\[TIRADA:\s*(\d+d\d+)([+-]\d+)?\s*vs\s*DC\s*(\d+)\]/i);
    if (diceMatch) {
      result.diceRoll = {
        suggested: diceMatch[1],
        modifier: diceMatch[2] ? parseInt(diceMatch[2], 10) : 0,
        dc: parseInt(diceMatch[3], 10)
      };
    }

    // Extract HP changes
    const hpMatch = responseText.match(/\[HP:\s*([+-]\d+)\]/i);
    if (hpMatch) {
      result.characterUpdate = {
        hpChange: parseInt(hpMatch[1], 10)
      };
    }

    // Extract item changes
    const itemMatches = responseText.matchAll(/\[ITEM:\s*([+-])(.+?)\]/gi);
    for (const match of itemMatches) {
      if (!result.characterUpdate) result.characterUpdate = {};
      if (!result.characterUpdate.inventory) result.characterUpdate.inventory = [];
      result.characterUpdate.inventory.push({
        action: match[1] === '+' ? 'add' : 'remove',
        name: match[2].trim()
      });
    }

    // Process story markers through Story Engine
    if (roomId && hasSignificantMarkers(storyMarkers)) {
      try {
        await storyEngine.processAIResponse(roomId, responseText, {
          karma: storyMarkers.karma,
          npc_reactions: storyMarkers.npcReactions,
          clues_revealed: storyMarkers.cluesRevealed,
          decision_triggered: storyMarkers.decisionTriggered
        });
      } catch (err) {
        console.error('Failed to process story markers:', err.message);
      }
    }

    return result;
  } catch (err) {
    console.error('Groq API error:', err);
    throw new Error('Error al generar respuesta de IA');
  }
}

/**
 * Check if markers have any significant content to process.
 */
function hasSignificantMarkers(markers) {
  return markers.karma !== null ||
         Object.keys(markers.npcReactions).length > 0 ||
         markers.cluesRevealed.length > 0 ||
         markers.decisionTriggered !== null;
}

/**
 * Analyze player action before generating response (for pre-processing).
 */
async function analyzePlayerAction(roomId, userId, username, message, character) {
  if (!roomId) return null;

  try {
    const analysis = await storyEngine.analyzeAction({
      roomId,
      userId,
      username,
      message,
      characterName: character?.name,
      characterClass: character?.class
    });

    return analysis;
  } catch (err) {
    console.error('Failed to analyze player action:', err.message);
    return null;
  }
}

module.exports = {
  generateResponse,
  analyzePlayerAction,
  parseStoryMarkers,
  cleanStoryMarkers
};
