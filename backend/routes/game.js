const express = require('express');
const multer = require('multer');
const groqService = require('../services/groq');
const whisperService = require('../services/whisper');
const ttsService = require('../services/tts');

const router = express.Router();

// Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio'), false);
    }
  }
});

// Get game history for a room
router.get('/history/:roomCode', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;
  const { limit = 50, before } = req.query;

  try {
    // Verify participation
    const participantCheck = await pool.query(
      `SELECT r.id FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    const roomId = participantCheck.rows[0].id;

    let query = `
      SELECT gh.*, u.username as speaker_name
      FROM game_history gh
      LEFT JOIN users u ON gh.speaker LIKE 'user:%' AND u.id = CAST(REPLACE(gh.speaker, 'user:', '') AS INTEGER)
      WHERE gh.room_id = $1
    `;
    const values = [roomId];

    if (before) {
      query += ` AND gh.id < $2`;
      values.push(before);
    }

    query += ` ORDER BY gh.timestamp DESC LIMIT $${values.length + 1}`;
    values.push(parseInt(limit, 10));

    const result = await pool.query(query, values);

    // Reverse to get chronological order
    res.json({ history: result.rows.reverse() });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Process voice input (STT -> AI -> TTS)
router.post('/voice/:roomCode', upload.single('audio'), async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Archivo de audio requerido' });
  }

  try {
    // Verify participation and get room info
    const roomResult = await pool.query(
      `SELECT r.id, r.theme, r.game_context, t.system_prompt
       FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       JOIN themes t ON r.theme = t.name
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    const room = roomResult.rows[0];

    // Get user's character
    const charResult = await pool.query(
      'SELECT name, class, level, hp, max_hp, stats, inventory FROM characters WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    const character = charResult.rows[0] || null;

    // Get recent history for context
    const historyResult = await pool.query(
      `SELECT speaker, message FROM game_history
       WHERE room_id = $1 ORDER BY timestamp DESC LIMIT 10`,
      [room.id]
    );
    const recentHistory = historyResult.rows.reverse();

    // 1. Speech to Text
    console.log('Processing audio with Whisper...');
    const transcription = await whisperService.transcribe(req.file.buffer);
    console.log('Transcription:', transcription);

    if (!transcription || transcription.trim() === '') {
      return res.status(400).json({ error: 'No se pudo transcribir el audio' });
    }

    // Save user message to history
    await pool.query(
      'INSERT INTO game_history (room_id, speaker, message) VALUES ($1, $2, $3)',
      [room.id, `user:${req.user.id}`, transcription]
    );

    // 2. Generate AI response
    console.log('Generating AI response...');
    const aiResponse = await groqService.generateResponse({
      systemPrompt: room.system_prompt,
      gameContext: room.game_context,
      recentHistory,
      userMessage: transcription,
      character,
      username: req.user.username,
      roomId: room.id
    });

    console.log('AI Response:', aiResponse.text.substring(0, 100) + '...');

    // Save AI response to history
    await pool.query(
      'INSERT INTO game_history (room_id, speaker, message, dice_roll) VALUES ($1, $2, $3, $4)',
      [room.id, 'ia', aiResponse.text, aiResponse.diceRoll ? JSON.stringify(aiResponse.diceRoll) : null]
    );

    // Update game context if provided
    if (aiResponse.updatedContext) {
      await pool.query(
        'UPDATE rooms SET game_context = $1, last_activity = NOW() WHERE id = $2',
        [aiResponse.updatedContext, room.id]
      );
    }

    // 3. Text to Speech
    console.log('Generating TTS...');
    const audioBuffer = await ttsService.synthesize(aiResponse.text);

    // Notify room via Socket.IO
    const io = req.app.get('io');
    io.to(roomCode.toUpperCase()).emit('ai-message', {
      text: aiResponse.text,
      diceRoll: aiResponse.diceRoll,
      characterUpdate: aiResponse.characterUpdate,
      timestamp: new Date().toISOString()
    });

    // Return response
    res.json({
      transcription,
      aiResponse: aiResponse.text,
      diceRoll: aiResponse.diceRoll,
      characterUpdate: aiResponse.characterUpdate,
      audioBase64: audioBuffer ? audioBuffer.toString('base64') : null
    });
  } catch (err) {
    console.error('Voice processing error:', err);
    res.status(500).json({ error: 'Error al procesar audio: ' + err.message });
  }
});

// Send text message to AI (alternative to voice)
router.post('/message/:roomCode', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  try {
    // Verify participation and get room info
    const roomResult = await pool.query(
      `SELECT r.id, r.theme, r.game_context, t.system_prompt
       FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       JOIN themes t ON r.theme = t.name
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    const room = roomResult.rows[0];

    // Get user's character
    const charResult = await pool.query(
      'SELECT name, class, level, hp, max_hp, stats, inventory FROM characters WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    const character = charResult.rows[0] || null;

    // Get recent history
    const historyResult = await pool.query(
      `SELECT speaker, message FROM game_history
       WHERE room_id = $1 ORDER BY timestamp DESC LIMIT 10`,
      [room.id]
    );
    const recentHistory = historyResult.rows.reverse();

    // Save user message
    await pool.query(
      'INSERT INTO game_history (room_id, speaker, message) VALUES ($1, $2, $3)',
      [room.id, `user:${req.user.id}`, message]
    );

    // Generate AI response
    const aiResponse = await groqService.generateResponse({
      systemPrompt: room.system_prompt,
      gameContext: room.game_context,
      recentHistory,
      userMessage: message,
      character,
      username: req.user.username,
      roomId: room.id
    });

    // Save AI response
    await pool.query(
      'INSERT INTO game_history (room_id, speaker, message, dice_roll) VALUES ($1, $2, $3, $4)',
      [room.id, 'ia', aiResponse.text, aiResponse.diceRoll ? JSON.stringify(aiResponse.diceRoll) : null]
    );

    // Update context
    if (aiResponse.updatedContext) {
      await pool.query(
        'UPDATE rooms SET game_context = $1, last_activity = NOW() WHERE id = $2',
        [aiResponse.updatedContext, room.id]
      );
    }

    // Generate TTS
    const audioBuffer = await ttsService.synthesize(aiResponse.text);

    // Notify room
    const io = req.app.get('io');
    io.to(roomCode.toUpperCase()).emit('ai-message', {
      text: aiResponse.text,
      diceRoll: aiResponse.diceRoll,
      characterUpdate: aiResponse.characterUpdate,
      timestamp: new Date().toISOString()
    });

    res.json({
      aiResponse: aiResponse.text,
      diceRoll: aiResponse.diceRoll,
      characterUpdate: aiResponse.characterUpdate,
      audioBase64: audioBuffer ? audioBuffer.toString('base64') : null
    });
  } catch (err) {
    console.error('Message processing error:', err);
    res.status(500).json({ error: 'Error al procesar mensaje: ' + err.message });
  }
});

// Roll dice (standalone endpoint)
router.post('/roll/:roomCode', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;
  const { dice, modifier = 0, reason = '' } = req.body;

  if (!dice) {
    return res.status(400).json({ error: 'Tipo de dado requerido (ej: 1d20, 2d6)' });
  }

  try {
    // Verify participation
    const roomResult = await pool.query(
      `SELECT r.id FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    // Parse and roll dice
    const match = dice.match(/(\d+)d(\d+)/i);
    if (!match) {
      return res.status(400).json({ error: 'Formato de dado inválido. Usa NdX (ej: 1d20, 2d6)' });
    }

    const count = Math.min(parseInt(match[1], 10), 20); // Max 20 dice
    const sides = parseInt(match[2], 10);

    if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) {
      return res.status(400).json({ error: 'Dado inválido. Usa d4, d6, d8, d10, d12, d20 o d100' });
    }

    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = results.reduce((a, b) => a + b, 0) + parseInt(modifier, 10);

    // Save to history
    const diceRoll = { dice, results, modifier, total };
    await pool.query(
      'INSERT INTO game_history (room_id, speaker, message, dice_roll) VALUES ($1, $2, $3, $4)',
      [roomResult.rows[0].id, `user:${req.user.id}`, reason || `Tirada de ${dice}`, JSON.stringify(diceRoll)]
    );

    // Notify room
    const io = req.app.get('io');
    io.to(roomCode.toUpperCase()).emit('dice-result', {
      userId: req.user.id,
      username: req.user.username,
      dice,
      results,
      modifier,
      total,
      reason,
      timestamp: new Date().toISOString()
    });

    res.json({ dice, results, modifier, total });
  } catch (err) {
    console.error('Dice roll error:', err);
    res.status(500).json({ error: 'Error al tirar dados' });
  }
});

// Get LiveKit token for voice chat
router.get('/livekit-token/:roomCode', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;

  try {
    // Verify participation
    const participantCheck = await pool.query(
      `SELECT 1 FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    // Generate LiveKit token
    const { AccessToken } = require('livekit-server-sdk');

    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.user.id.toString(),
      name: req.user.username
    });

    at.addGrant({
      roomJoin: true,
      room: roomCode.toUpperCase(),
      canPublish: true,
      canSubscribe: true
    });

    const token = await at.toJwt();

    res.json({
      token,
      url: process.env.LIVEKIT_URL || 'wss://tctransports.it/rol/livekit/'
    });
  } catch (err) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ error: 'Error al generar token de voz' });
  }
});

// Synthesize text to speech (standalone)
router.post('/tts', async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Texto requerido' });
  }

  try {
    const audioBuffer = await ttsService.synthesize(text);

    if (!audioBuffer) {
      return res.status(500).json({ error: 'Error al generar audio' });
    }

    res.json({ audioBase64: audioBuffer.toString('base64') });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Error al sintetizar voz' });
  }
});

module.exports = router;
