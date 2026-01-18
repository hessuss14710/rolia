/**
 * Campaign Routes
 * Manages campaigns, story progress, and narrative decisions.
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/auth');
const storyEngine = require('../services/storyEngine');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ===========================================
// List Campaigns
// ===========================================

/**
 * GET /campaigns
 * List all available campaigns, optionally filtered by theme.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { theme_id } = req.query;

    // Try Story Engine first
    const engineCampaigns = await storyEngine.listCampaigns(theme_id ? parseInt(theme_id) : null);

    if (engineCampaigns && engineCampaigns.length > 0) {
      return res.json({ campaigns: engineCampaigns });
    }

    // Fallback to direct DB query
    let query = `
      SELECT id, theme_id, name, code, synopsis, tone, difficulty,
             estimated_sessions, total_acts, is_active
      FROM campaigns
      WHERE is_active = TRUE
    `;
    const values = [];

    if (theme_id) {
      query += ' AND theme_id = $1';
      values.push(theme_id);
    }

    query += ' ORDER BY name';

    const { rows } = await pool.query(query, values);
    res.json({ campaigns: rows });
  } catch (err) {
    console.error('Error listing campaigns:', err);
    res.status(500).json({ error: 'Error al listar campañas' });
  }
});

// ===========================================
// Get Campaign Details
// ===========================================

/**
 * GET /campaigns/:id
 * Get detailed information about a specific campaign.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Try Story Engine first
    const campaign = await storyEngine.getCampaign(parseInt(id));

    if (campaign) {
      return res.json(campaign);
    }

    // Fallback to direct DB query
    const { rows } = await pool.query(`
      SELECT c.*, t.name as theme_name, t.description as theme_description
      FROM campaigns c
      LEFT JOIN themes t ON t.id = c.theme_id
      WHERE c.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error getting campaign:', err);
    res.status(500).json({ error: 'Error al obtener campaña' });
  }
});

// ===========================================
// Get Campaign Structure
// ===========================================

/**
 * GET /campaigns/:id/structure
 * Get the full structure of a campaign (acts, chapters, scenes).
 */
router.get('/:id/structure', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get acts
    const acts = await pool.query(`
      SELECT id, act_number, title, description, objectives, estimated_sessions
      FROM story_acts
      WHERE campaign_id = $1
      ORDER BY act_number
    `, [id]);

    // Get chapters for each act
    const structure = [];

    for (const act of acts.rows) {
      const chapters = await pool.query(`
        SELECT id, chapter_number, title, narrative_hook, is_optional
        FROM story_chapters
        WHERE act_id = $1
        ORDER BY chapter_number
      `, [act.id]);

      structure.push({
        ...act,
        chapters: chapters.rows
      });
    }

    res.json({ structure });
  } catch (err) {
    console.error('Error getting campaign structure:', err);
    res.status(500).json({ error: 'Error al obtener estructura de campaña' });
  }
});

// ===========================================
// Room Progress
// ===========================================

/**
 * GET /campaigns/progress/:roomCode
 * Get campaign progress for a room.
 */
router.get('/progress/:roomCode', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;

    // Get room ID
    const roomResult = await pool.query(
      'SELECT id, campaign_id FROM rooms WHERE code = $1',
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const room = roomResult.rows[0];

    if (!room.campaign_id) {
      return res.json({ progress: null, message: 'Esta sala no tiene campaña asignada' });
    }

    // Try Story Engine
    const storyState = await storyEngine.getStoryState(room.id);

    if (storyState) {
      return res.json({ progress: storyState });
    }

    // Fallback to direct DB query
    const { rows } = await pool.query(`
      SELECT rcp.*, c.name as campaign_name, c.code as campaign_code
      FROM room_campaign_progress rcp
      JOIN campaigns c ON c.id = rcp.campaign_id
      WHERE rcp.room_id = $1
    `, [room.id]);

    if (rows.length === 0) {
      return res.json({ progress: null });
    }

    res.json({ progress: rows[0] });
  } catch (err) {
    console.error('Error getting room progress:', err);
    res.status(500).json({ error: 'Error al obtener progreso' });
  }
});

/**
 * POST /campaigns/progress/:roomCode/initialize
 * Initialize campaign progress for a room.
 */
router.post('/progress/:roomCode/initialize', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({ error: 'Se requiere campaignId' });
    }

    // Get room
    const roomResult = await pool.query(
      'SELECT id, owner_id FROM rooms WHERE code = $1',
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const room = roomResult.rows[0];

    // Check if user is owner
    if (room.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el dueño de la sala puede asignar campaña' });
    }

    // Check if campaign exists
    const campaignResult = await pool.query(
      'SELECT id, name FROM campaigns WHERE id = $1 AND is_active = TRUE',
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    // Update room with campaign
    await pool.query(
      'UPDATE rooms SET campaign_id = $1 WHERE id = $2',
      [campaignId, room.id]
    );

    // Initialize progress via Story Engine
    const result = await storyEngine.initializeProgress(room.id, campaignId);

    if (result) {
      return res.json({
        message: 'Campaña iniciada correctamente',
        progress: result.progress
      });
    }

    // Fallback: Create progress directly
    const progressResult = await pool.query(`
      INSERT INTO room_campaign_progress (room_id, campaign_id)
      VALUES ($1, $2)
      ON CONFLICT (room_id, campaign_id) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `, [room.id, campaignId]);

    res.json({
      message: 'Campaña iniciada correctamente',
      progress: progressResult.rows[0]
    });
  } catch (err) {
    console.error('Error initializing progress:', err);
    res.status(500).json({ error: 'Error al iniciar campaña' });
  }
});

// ===========================================
// Decisions
// ===========================================

/**
 * GET /campaigns/decisions/:roomCode/pending
 * Get pending decision for a room.
 */
router.get('/decisions/:roomCode/pending', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;

    // Get room ID
    const roomResult = await pool.query(
      'SELECT id FROM rooms WHERE code = $1',
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const roomId = roomResult.rows[0].id;

    // Get pending decision from Story Engine
    const pendingDecision = await storyEngine.getPendingDecision(roomId);

    res.json({ pendingDecision });
  } catch (err) {
    console.error('Error getting pending decision:', err);
    res.status(500).json({ error: 'Error al obtener decisión pendiente' });
  }
});

/**
 * POST /campaigns/decisions/:roomCode
 * Make a story decision.
 */
router.post('/decisions/:roomCode', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { decisionCode, chosenOption } = req.body;

    if (!decisionCode || !chosenOption) {
      return res.status(400).json({ error: 'Se requiere decisionCode y chosenOption' });
    }

    // Get room ID
    const roomResult = await pool.query(
      'SELECT id FROM rooms WHERE code = $1',
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const roomId = roomResult.rows[0].id;

    // Process decision via Story Engine
    const result = await storyEngine.processDecision(roomId, decisionCode, chosenOption);

    if (!result) {
      return res.status(400).json({ error: 'Error al procesar decisión' });
    }

    res.json({
      message: 'Decisión registrada',
      result
    });
  } catch (err) {
    console.error('Error processing decision:', err);
    res.status(500).json({ error: 'Error al procesar decisión' });
  }
});

// ===========================================
// Story State & Endings
// ===========================================

/**
 * GET /campaigns/endings/:roomCode
 * Calculate ending probabilities for a room.
 */
router.get('/endings/:roomCode', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;

    // Get room ID
    const roomResult = await pool.query(
      'SELECT id FROM rooms WHERE code = $1',
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const roomId = roomResult.rows[0].id;

    // Calculate endings via Story Engine
    const endings = await storyEngine.calculateEnding(roomId);

    res.json(endings || { probabilities: {}, message: 'No se puede calcular finales' });
  } catch (err) {
    console.error('Error calculating endings:', err);
    res.status(500).json({ error: 'Error al calcular finales' });
  }
});

/**
 * GET /campaigns/npcs/:roomCode
 * Get NPC states for a room.
 */
router.get('/npcs/:roomCode', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;

    // Get room and campaign
    const roomResult = await pool.query(`
      SELECT r.id, r.campaign_id
      FROM rooms r
      WHERE r.code = $1
    `, [roomCode.toUpperCase()]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const { id: roomId, campaign_id: campaignId } = roomResult.rows[0];

    if (!campaignId) {
      return res.json({ npcs: [] });
    }

    // Get NPCs with relationships
    const { rows } = await pool.query(`
      SELECT
        n.code, n.name, n.apparent_role, n.description,
        COALESCE(r.relationship_score, n.relationship_default) as relationship,
        COALESCE(r.trust_level, 50) as trust,
        COALESCE(r.emotional_state, 'neutral') as emotional_state,
        COALESCE(r.known_secrets, '{}') as known_secrets
      FROM story_npcs n
      LEFT JOIN room_npc_relationships r ON r.npc_id = n.id AND r.room_id = $1
      WHERE n.campaign_id = $2 AND n.is_major = TRUE
      ORDER BY n.name
    `, [roomId, campaignId]);

    res.json({ npcs: rows });
  } catch (err) {
    console.error('Error getting NPCs:', err);
    res.status(500).json({ error: 'Error al obtener NPCs' });
  }
});

// ===========================================
// Story Events Log
// ===========================================

/**
 * GET /campaigns/events/:roomCode
 * Get story events log for a room.
 */
router.get('/events/:roomCode', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { limit = 20, type } = req.query;

    // Get room ID
    const roomResult = await pool.query(
      'SELECT id FROM rooms WHERE code = $1',
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const roomId = roomResult.rows[0].id;

    // Build query
    let query = `
      SELECT id, event_type, event_data, created_at
      FROM story_events
      WHERE room_id = $1
    `;
    const values = [roomId];

    if (type) {
      query += ' AND event_type = $2';
      values.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(parseInt(limit));

    const { rows } = await pool.query(query, values);

    res.json({ events: rows });
  } catch (err) {
    console.error('Error getting events:', err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// ===========================================
// Health Check
// ===========================================

/**
 * GET /campaigns/health
 * Check Story Engine health.
 */
router.get('/health', async (req, res) => {
  const healthy = await storyEngine.healthCheck();
  res.json({
    storyEngine: healthy ? 'connected' : 'disconnected',
    status: healthy ? 'ok' : 'degraded'
  });
});

module.exports = router;
