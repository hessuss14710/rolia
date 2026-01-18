const express = require('express');
const router = express.Router();

// Generate random room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all themes
router.get('/themes', async (req, res) => {
  const pool = req.app.get('db');

  try {
    const result = await pool.query(
      'SELECT id, name, description, example_classes FROM themes ORDER BY name'
    );
    res.json({ themes: result.rows });
  } catch (err) {
    console.error('Get themes error:', err);
    res.status(500).json({ error: 'Error al obtener temas' });
  }
});

// Get user's rooms (as owner or participant)
router.get('/', async (req, res) => {
  const pool = req.app.get('db');

  try {
    const result = await pool.query(
      `SELECT DISTINCT r.id, r.code, r.name, r.theme, r.status, r.max_players,
              r.owner_id, u.username as owner_name, r.created_at, r.last_activity,
              (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as player_count
       FROM rooms r
       JOIN users u ON r.owner_id = u.id
       LEFT JOIN room_participants rp ON r.id = rp.room_id
       WHERE r.owner_id = $1 OR rp.user_id = $1
       ORDER BY r.last_activity DESC`,
      [req.user.id]
    );

    res.json({ rooms: result.rows });
  } catch (err) {
    console.error('Get rooms error:', err);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

// Create room
router.post('/', async (req, res) => {
  const pool = req.app.get('db');
  const { name, theme, maxPlayers = 6, campaignId = null } = req.body;

  if (!name || !theme) {
    return res.status(400).json({ error: 'Nombre y tema son requeridos' });
  }

  try {
    // Generate unique code
    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateRoomCode();
      const existing = await pool.query('SELECT id FROM rooms WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ error: 'No se pudo generar código de sala' });
    }

    // Validate campaign if provided
    if (campaignId) {
      const campaignCheck = await pool.query(
        'SELECT id, theme_id FROM campaigns WHERE id = $1',
        [campaignId]
      );
      if (campaignCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Campaña no encontrada' });
      }
    }

    // Create room
    const result = await pool.query(
      `INSERT INTO rooms (code, name, theme, owner_id, max_players, campaign_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, name, theme, status, max_players, campaign_id, created_at`,
      [code, name, theme, req.user.id, Math.min(maxPlayers, 6), campaignId]
    );

    const room = result.rows[0];

    // Add owner as participant
    await pool.query(
      'INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2)',
      [room.id, req.user.id]
    );

    // Initialize campaign progress if campaign selected
    if (campaignId) {
      // Get first scene
      const firstSceneResult = await pool.query(
        `SELECT s.id as scene_id, c.id as chapter_id, a.id as act_id
         FROM story_acts a
         JOIN story_chapters c ON c.act_id = a.id
         JOIN story_scenes s ON s.chapter_id = c.id
         WHERE a.campaign_id = $1
         ORDER BY a.act_number, c.chapter_number, s.scene_order
         LIMIT 1`,
        [campaignId]
      );

      if (firstSceneResult.rows.length > 0) {
        const firstScene = firstSceneResult.rows[0];
        await pool.query(
          `INSERT INTO room_campaign_progress
           (room_id, campaign_id, current_act, current_chapter, current_scene)
           VALUES ($1, $2, $3, $4, $5)`,
          [room.id, campaignId, firstScene.act_id, firstScene.chapter_id, firstScene.scene_id]
        );
      }

      // Get campaign name for response
      const campaignInfo = await pool.query(
        'SELECT name FROM campaigns WHERE id = $1',
        [campaignId]
      );
      room.campaign_name = campaignInfo.rows[0]?.name;
    }

    res.status(201).json({ room });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Error al crear sala' });
  }
});

// Get room by code
router.get('/code/:code', async (req, res) => {
  const pool = req.app.get('db');
  const { code } = req.params;

  try {
    const result = await pool.query(
      `SELECT r.*, u.username as owner_name,
              c.name as campaign_name, c.synopsis as campaign_synopsis,
              (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as player_count
       FROM rooms r
       JOIN users u ON r.owner_id = u.id
       LEFT JOIN campaigns c ON r.campaign_id = c.id
       WHERE r.code = $1`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const room = result.rows[0];

    // Check if user is participant
    const participantCheck = await pool.query(
      'SELECT 1 FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    room.isParticipant = participantCheck.rows.length > 0;
    room.isOwner = room.owner_id === req.user.id;

    // Get participants
    const participants = await pool.query(
      `SELECT u.id, u.username, rp.joined_at
       FROM room_participants rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = $1`,
      [room.id]
    );
    room.participants = participants.rows;

    // Get campaign progress if campaign exists
    if (room.campaign_id) {
      const progressResult = await pool.query(
        `SELECT rcp.*,
                sa.title as act_title, sa.act_number,
                sc.title as chapter_title, sc.chapter_number,
                ss.title as scene_title, ss.scene_order
         FROM room_campaign_progress rcp
         LEFT JOIN story_acts sa ON rcp.current_act = sa.id
         LEFT JOIN story_chapters sc ON rcp.current_chapter = sc.id
         LEFT JOIN story_scenes ss ON rcp.current_scene = ss.id
         WHERE rcp.room_id = $1`,
        [room.id]
      );
      if (progressResult.rows.length > 0) {
        room.campaign_progress = progressResult.rows[0];
      }
    }

    res.json({ room });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Error al obtener sala' });
  }
});

// Join room by code
router.post('/join/:code', async (req, res) => {
  const pool = req.app.get('db');
  const { code } = req.params;

  try {
    // Find room
    const roomResult = await pool.query(
      `SELECT r.*, (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as player_count
       FROM rooms r WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const room = roomResult.rows[0];

    // Check if room is full
    if (room.player_count >= room.max_players) {
      return res.status(400).json({ error: 'La sala está llena' });
    }

    // Check if already participant
    const existingParticipant = await pool.query(
      'SELECT 1 FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    if (existingParticipant.rows.length > 0) {
      return res.json({ room, message: 'Ya eres participante de esta sala' });
    }

    // Add participant
    await pool.query(
      'INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2)',
      [room.id, req.user.id]
    );

    // Update last activity
    await pool.query('UPDATE rooms SET last_activity = NOW() WHERE id = $1', [room.id]);

    res.json({ room, message: 'Te has unido a la sala' });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Error al unirse a la sala' });
  }
});

// Leave room
router.post('/leave/:code', async (req, res) => {
  const pool = req.app.get('db');
  const { code } = req.params;

  try {
    const roomResult = await pool.query('SELECT id, owner_id FROM rooms WHERE code = $1', [code.toUpperCase()]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const room = roomResult.rows[0];

    // Owner cannot leave (must delete room)
    if (room.owner_id === req.user.id) {
      return res.status(400).json({ error: 'El propietario no puede abandonar la sala. Usa eliminar.' });
    }

    await pool.query(
      'DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    // Delete user's character in this room
    await pool.query(
      'DELETE FROM characters WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    res.json({ message: 'Has abandonado la sala' });
  } catch (err) {
    console.error('Leave room error:', err);
    res.status(500).json({ error: 'Error al abandonar sala' });
  }
});

// Update room status (owner only)
router.put('/:code/status', async (req, res) => {
  const pool = req.app.get('db');
  const { code } = req.params;
  const { status } = req.body;

  const validStatuses = ['waiting', 'playing', 'paused', 'ended'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const result = await pool.query(
      `UPDATE rooms SET status = $1, last_activity = NOW()
       WHERE code = $2 AND owner_id = $3
       RETURNING id, code, name, status`,
      [status, code.toUpperCase(), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta sala' });
    }

    // Notify via Socket.IO
    const io = req.app.get('io');
    io.to(code.toUpperCase()).emit('room-status-changed', { status });

    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error('Update room status error:', err);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Delete room (owner only)
router.delete('/:code', async (req, res) => {
  const pool = req.app.get('db');
  const { code } = req.params;

  try {
    // Verify ownership
    const roomResult = await pool.query(
      'SELECT id FROM rooms WHERE code = $1 AND owner_id = $2',
      [code.toUpperCase(), req.user.id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta sala' });
    }

    const roomId = roomResult.rows[0].id;

    // Delete in order (foreign keys)
    await pool.query('DELETE FROM game_history WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM characters WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM room_participants WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM room_npc_relationships WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM room_campaign_progress WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM story_events WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);

    // Notify via Socket.IO
    const io = req.app.get('io');
    io.to(code.toUpperCase()).emit('room-deleted');

    res.json({ message: 'Sala eliminada' });
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Error al eliminar sala' });
  }
});

module.exports = router;
