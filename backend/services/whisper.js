const FormData = require('form-data');
const fetch = require('node-fetch');

const WHISPER_URL = process.env.WHISPER_URL || 'http://rolia-whisper:9000';

async function transcribe(audioBuffer) {
  try {
    const formData = new FormData();
    formData.append('audio_file', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });

    const response = await fetch(`${WHISPER_URL}/asr?task=transcribe&language=es&output=json`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper error response:', errorText);
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const result = await response.json();
    return result.text || '';
  } catch (err) {
    console.error('Whisper transcription error:', err);

    // Fallback: try Groq's Whisper API
    try {
      console.log('Trying Groq Whisper fallback...');
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      const transcription = await groq.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-large-v3',
        language: 'es',
        response_format: 'json'
      });

      return transcription.text || '';
    } catch (groqErr) {
      console.error('Groq Whisper fallback error:', groqErr);
      throw new Error('Error al transcribir audio');
    }
  }
}

module.exports = { transcribe };
