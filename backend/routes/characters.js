const express = require('express');
const router = express.Router();

// Get user's characters
router.get('/', async (req, res) => {
  const pool = req.app.get('db');

  try {
    const result = await pool.query(
      `SELECT c.*, r.code as room_code, r.name as room_name, r.theme as room_theme
       FROM characters c
       JOIN rooms r ON c.room_id = r.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    res.json({ characters: result.rows });
  } catch (err) {
    console.error('Get characters error:', err);
    res.status(500).json({ error: 'Error al obtener personajes' });
  }
});

// Get character by id
router.get('/:id', async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.*, r.code as room_code, r.name as room_name, r.theme as room_theme
       FROM characters c
       JOIN rooms r ON c.room_id = r.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    res.json({ character: result.rows[0] });
  } catch (err) {
    console.error('Get character error:', err);
    res.status(500).json({ error: 'Error al obtener personaje' });
  }
});

// Get character for a specific room
router.get('/room/:roomCode', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.* FROM characters c
       JOIN rooms r ON c.room_id = r.id
       WHERE r.code = $1 AND c.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ character: null });
    }

    res.json({ character: result.rows[0] });
  } catch (err) {
    console.error('Get room character error:', err);
    res.status(500).json({ error: 'Error al obtener personaje' });
  }
});

// Get all characters in a room (for viewing other players)
router.get('/room/:roomCode/all', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode } = req.params;

  try {
    // Verify user is participant
    const participantCheck = await pool.query(
      `SELECT 1 FROM room_participants rp
       JOIN rooms r ON rp.room_id = r.id
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    const result = await pool.query(
      `SELECT c.id, c.name, c.class, c.level, c.hp, c.max_hp, c.user_id, u.username
       FROM characters c
       JOIN rooms r ON c.room_id = r.id
       JOIN users u ON c.user_id = u.id
       WHERE r.code = $1`,
      [roomCode.toUpperCase()]
    );

    res.json({ characters: result.rows });
  } catch (err) {
    console.error('Get room characters error:', err);
    res.status(500).json({ error: 'Error al obtener personajes de la sala' });
  }
});

// Create character
router.post('/', async (req, res) => {
  const pool = req.app.get('db');
  const { roomCode, name, characterClass, stats, background } = req.body;

  if (!roomCode || !name) {
    return res.status(400).json({ error: 'Código de sala y nombre son requeridos' });
  }

  try {
    // Get room and verify participation
    const roomResult = await pool.query(
      `SELECT r.id, r.theme FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       WHERE r.code = $1 AND rp.user_id = $2`,
      [roomCode.toUpperCase(), req.user.id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(403).json({ error: 'No eres participante de esta sala' });
    }

    const room = roomResult.rows[0];

    // Check if user already has character in this room
    const existingChar = await pool.query(
      'SELECT id FROM characters WHERE room_id = $1 AND user_id = $2',
      [room.id, req.user.id]
    );

    if (existingChar.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes un personaje en esta sala' });
    }

    // Get default stats from theme if not provided
    let finalStats = stats;
    if (!finalStats) {
      const themeResult = await pool.query(
        'SELECT default_stats FROM themes WHERE name = $1',
        [room.theme]
      );
      if (themeResult.rows.length > 0) {
        finalStats = themeResult.rows[0].default_stats;
      } else {
        finalStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      }
    }

    // Calculate HP based on constitution (if fantasy-style stats)
    const con = finalStats.con || finalStats.resistencia || finalStats.cuerpo || 10;
    const baseHp = 10 + Math.floor((con - 10) / 2) * 2;

    const result = await pool.query(
      `INSERT INTO characters (user_id, room_id, name, class, stats, hp, max_hp, background)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
       RETURNING *`,
      [req.user.id, room.id, name, characterClass || 'Aventurero', JSON.stringify(finalStats), baseHp, background || '']
    );

    // Notify room via Socket.IO
    const io = req.app.get('io');
    io.to(roomCode.toUpperCase()).emit('character-created', {
      character: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        class: result.rows[0].class,
        level: result.rows[0].level,
        user_id: req.user.id,
        username: req.user.username
      }
    });

    res.status(201).json({ character: result.rows[0] });
  } catch (err) {
    console.error('Create character error:', err);
    res.status(500).json({ error: 'Error al crear personaje' });
  }
});

// Update character
router.put('/:id', async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { name, characterClass, stats, hp, level, inventory, background, notes } = req.body;

  try {
    // Verify ownership
    const charResult = await pool.query(
      'SELECT c.*, r.code as room_code FROM characters c JOIN rooms r ON c.room_id = r.id WHERE c.id = $1 AND c.user_id = $2',
      [id, req.user.id]
    );

    if (charResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    const character = charResult.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (characterClass !== undefined) {
      updates.push(`class = $${paramCount++}`);
      values.push(characterClass);
    }
    if (stats !== undefined) {
      updates.push(`stats = $${paramCount++}`);
      values.push(JSON.stringify(stats));
    }
    if (hp !== undefined) {
      updates.push(`hp = $${paramCount++}`);
      values.push(Math.max(0, Math.min(hp, character.max_hp)));
    }
    if (level !== undefined) {
      updates.push(`level = $${paramCount++}`);
      values.push(Math.max(1, level));
    }
    if (inventory !== undefined) {
      updates.push(`inventory = $${paramCount++}`);
      values.push(JSON.stringify(inventory));
    }
    if (background !== undefined) {
      updates.push(`background = $${paramCount++}`);
      values.push(background);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    // Notify room via Socket.IO
    const io = req.app.get('io');
    io.to(character.room_code).emit('character-updated', {
      characterId: result.rows[0].id,
      updates: { name, characterClass, hp, level }
    });

    res.json({ character: result.rows[0] });
  } catch (err) {
    console.error('Update character error:', err);
    res.status(500).json({ error: 'Error al actualizar personaje' });
  }
});

// Add item to inventory
router.post('/:id/inventory', async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { name, quantity = 1, description = '' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nombre del item requerido' });
  }

  try {
    const charResult = await pool.query(
      'SELECT inventory FROM characters WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (charResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    let inventory = charResult.rows[0].inventory || [];

    // Check if item already exists
    const existingIndex = inventory.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) {
      inventory[existingIndex].quantity += quantity;
    } else {
      inventory.push({ name, quantity, description });
    }

    const result = await pool.query(
      'UPDATE characters SET inventory = $1 WHERE id = $2 RETURNING inventory',
      [JSON.stringify(inventory), id]
    );

    res.json({ inventory: result.rows[0].inventory });
  } catch (err) {
    console.error('Add inventory error:', err);
    res.status(500).json({ error: 'Error al añadir item' });
  }
});

// Remove item from inventory
router.delete('/:id/inventory/:itemName', async (req, res) => {
  const pool = req.app.get('db');
  const { id, itemName } = req.params;
  const { quantity = 1 } = req.body;

  try {
    const charResult = await pool.query(
      'SELECT inventory FROM characters WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (charResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    let inventory = charResult.rows[0].inventory || [];
    const itemIndex = inventory.findIndex(item => item.name.toLowerCase() === itemName.toLowerCase());

    if (itemIndex < 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    inventory[itemIndex].quantity -= quantity;
    if (inventory[itemIndex].quantity <= 0) {
      inventory.splice(itemIndex, 1);
    }

    const result = await pool.query(
      'UPDATE characters SET inventory = $1 WHERE id = $2 RETURNING inventory',
      [JSON.stringify(inventory), id]
    );

    res.json({ inventory: result.rows[0].inventory });
  } catch (err) {
    console.error('Remove inventory error:', err);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// Delete character
router.delete('/:id', async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM characters WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    res.json({ message: 'Personaje eliminado' });
  } catch (err) {
    console.error('Delete character error:', err);
    res.status(500).json({ error: 'Error al eliminar personaje' });
  }
});

module.exports = router;
