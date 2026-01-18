const fetch = require('node-fetch');

const PIPER_URL = process.env.PIPER_URL || 'http://host.docker.internal:5050';

async function synthesize(text) {
  if (!text || text.trim() === '') {
    return null;
  }

  try {
    // Clean text for TTS
    const cleanText = text
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/\*/g, '')   // Remove markdown italic
      .replace(/_/g, '')    // Remove underscores
      .replace(/\[.*?\]/g, '') // Remove brackets
      .replace(/\n+/g, '. ') // Replace newlines with pauses
      .trim();

    if (!cleanText) {
      return null;
    }

    const response = await fetch(`${PIPER_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: cleanText,
        voice: 'es_ES-davefx-medium' // Spanish voice
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Piper TTS error:', errorText);
      throw new Error(`Piper API error: ${response.status}`);
    }

    const audioBuffer = await response.buffer();
    return audioBuffer;
  } catch (err) {
    console.error('TTS synthesis error:', err);
    // Don't throw - TTS is optional, we can still return text
    return null;
  }
}

module.exports = { synthesize };
