const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function generateResponse({ systemPrompt, gameContext, recentHistory, userMessage, character, username }) {
  // Build context message
  let contextMessage = systemPrompt || 'Eres un narrador de rol experto.';

  contextMessage += `\n\n## Instrucciones adicionales:
- Responde siempre en español
- Mantén las respuestas concisas pero inmersivas (máximo 3-4 párrafos)
- Si el jugador intenta una acción que requiere tirada de dados, indica qué dado tirar y la dificultad
- Usa el formato [TIRADA: XdY+Z vs DC] cuando propongas tiradas
- Si el resultado de una tirada afecta al personaje (daño, curación), indica [HP: -X] o [HP: +X]
- Para añadir items al inventario usa [ITEM: +nombre]
- Para quitar items usa [ITEM: -nombre]
- Nunca reveles que eres una IA, mantén el rol de narrador misterioso`;

  if (gameContext) {
    contextMessage += `\n\n## Contexto actual de la partida:\n${gameContext}`;
  }

  if (character) {
    contextMessage += `\n\n## Personaje del jugador (${username}):
- Nombre: ${character.name}
- Clase: ${character.class}
- Nivel: ${character.level}
- HP: ${character.hp}/${character.max_hp}
- Estadísticas: ${JSON.stringify(character.stats)}
- Inventario: ${JSON.stringify(character.inventory || [])}`;
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

    // Parse special markers from response
    const result = {
      text: responseText.replace(/\[TIRADA:.*?\]/g, '').replace(/\[HP:.*?\]/g, '').replace(/\[ITEM:.*?\]/g, '').trim(),
      diceRoll: null,
      characterUpdate: null,
      updatedContext: null
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

    return result;
  } catch (err) {
    console.error('Groq API error:', err);
    throw new Error('Error al generar respuesta de IA');
  }
}

module.exports = { generateResponse };
