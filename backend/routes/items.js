const express = require('express');
const router = express.Router();

// ============================================
// CATALOG ENDPOINTS
// ============================================

// GET /items - Listar catalogo de items
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { type, rarity, search } = req.query;

    let query = 'SELECT * FROM items WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND item_type = $${params.length}`;
    }

    if (rarity) {
      params.push(rarity);
      query += ` AND rarity = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    query += ' ORDER BY rarity DESC, item_type, name';

    const result = await pool.query(query, params);
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Error al obtener items' });
  }
});

// GET /items/:code - Detalle de un item
router.get('/item/:code', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { code } = req.params;

    const result = await pool.query('SELECT * FROM items WHERE code = $1', [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ error: 'Error al obtener item' });
  }
});

// ============================================
// INVENTORY ENDPOINTS
// ============================================

// GET /items/inventory/:charId - Inventario del personaje
router.get('/inventory/:charId', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;

    // Verificar que el personaje pertenece al usuario
    const charCheck = await pool.query(
      'SELECT id, gold FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    const result = await pool.query(`
      SELECT ci.*, i.code, i.name, i.description, i.item_type, i.rarity,
             i.slot, i.icon_emoji, i.stats_bonus, i.effects, i.base_price,
             i.is_consumable, i.level_required
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = $1
      ORDER BY i.item_type, i.rarity DESC, i.name
    `, [charId]);

    res.json({
      inventory: result.rows,
      gold: charCheck.rows[0].gold
    });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// POST /items/inventory/:charId/add - Agregar item al inventario (sistema/AI)
router.post('/inventory/:charId/add', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;
    const { itemCode, quantity = 1, source = 'system' } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Obtener item del catalogo
    const itemResult = await pool.query('SELECT id, name FROM items WHERE code = $1', [itemCode]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado en el catalogo' });
    }

    const itemId = itemResult.rows[0].id;

    // Insertar o actualizar inventario
    await pool.query(`
      INSERT INTO character_inventory (character_id, item_id, quantity, acquired_source)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (character_id, item_id)
      DO UPDATE SET quantity = character_inventory.quantity + $3
    `, [charId, itemId, quantity, source]);

    // Log de transaccion
    await pool.query(`
      INSERT INTO economy_transactions (character_id, transaction_type, item_changes, description)
      VALUES ($1, $2, $3, $4)
    `, [charId, source, JSON.stringify([{ item_code: itemCode, quantity, action: 'add' }]), `Item obtenido: ${itemResult.rows[0].name}`]);

    res.json({ success: true, message: `${itemResult.rows[0].name} x${quantity} agregado` });
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).json({ error: 'Error al agregar item' });
  }
});

// POST /items/inventory/:charId/remove - Quitar item del inventario
router.post('/inventory/:charId/remove', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;
    const { itemCode, quantity = 1 } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Obtener item
    const itemResult = await pool.query('SELECT id, name FROM items WHERE code = $1', [itemCode]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const itemId = itemResult.rows[0].id;

    // Verificar que tiene suficiente cantidad
    const invCheck = await pool.query(
      'SELECT quantity FROM character_inventory WHERE character_id = $1 AND item_id = $2',
      [charId, itemId]
    );

    if (invCheck.rows.length === 0 || invCheck.rows[0].quantity < quantity) {
      return res.status(400).json({ error: 'No tienes suficientes de ese item' });
    }

    const newQty = invCheck.rows[0].quantity - quantity;

    if (newQty <= 0) {
      await pool.query(
        'DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2',
        [charId, itemId]
      );
    } else {
      await pool.query(
        'UPDATE character_inventory SET quantity = $1 WHERE character_id = $2 AND item_id = $3',
        [newQty, charId, itemId]
      );
    }

    res.json({ success: true, message: `${itemResult.rows[0].name} x${quantity} removido` });
  } catch (err) {
    console.error('Error removing item:', err);
    res.status(500).json({ error: 'Error al quitar item' });
  }
});

// ============================================
// EQUIPMENT ENDPOINTS
// ============================================

// GET /items/equipment/:charId - Items equipados
router.get('/equipment/:charId', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    const result = await pool.query(`
      SELECT ce.slot, ce.equipped_at, i.*
      FROM character_equipment ce
      JOIN items i ON ce.item_id = i.id
      WHERE ce.character_id = $1
    `, [charId]);

    // Construir objeto de slots
    const equipment = {
      weapon: null,
      armor: null,
      accessory1: null,
      accessory2: null
    };

    result.rows.forEach(row => {
      equipment[row.slot] = row;
    });

    // Calcular stats bonus totales
    let totalBonus = {};
    result.rows.forEach(row => {
      if (row.stats_bonus) {
        Object.entries(row.stats_bonus).forEach(([stat, value]) => {
          totalBonus[stat] = (totalBonus[stat] || 0) + value;
        });
      }
    });

    res.json({ equipment, totalBonus });
  } catch (err) {
    console.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Error al obtener equipamiento' });
  }
});

// POST /items/equipment/:charId/equip - Equipar item
router.post('/equipment/:charId/equip', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;
    const { itemId, slot } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id, level FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Verificar que el personaje tiene el item
    const invCheck = await pool.query(`
      SELECT ci.*, i.slot as item_slot, i.level_required, i.name
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = $1 AND ci.item_id = $2
    `, [charId, itemId]);

    if (invCheck.rows.length === 0) {
      return res.status(400).json({ error: 'No tienes este item' });
    }

    const item = invCheck.rows[0];

    // Verificar nivel requerido
    if (item.level_required > charCheck.rows[0].level) {
      return res.status(400).json({ error: `Requieres nivel ${item.level_required}` });
    }

    // Verificar slot valido
    const validSlots = ['weapon', 'armor', 'accessory1', 'accessory2'];
    if (!validSlots.includes(slot)) {
      return res.status(400).json({ error: 'Slot invalido' });
    }

    // Verificar que el item puede ir en ese slot
    if (item.item_slot && !slot.startsWith(item.item_slot.replace(/[12]/, ''))) {
      return res.status(400).json({ error: 'Este item no puede equiparse en ese slot' });
    }

    // Desequipar item actual si hay uno
    const currentEquip = await pool.query(
      'SELECT item_id FROM character_equipment WHERE character_id = $1 AND slot = $2',
      [charId, slot]
    );

    if (currentEquip.rows.length > 0) {
      // Devolver item actual al inventario
      await pool.query(`
        INSERT INTO character_inventory (character_id, item_id, quantity, acquired_source)
        VALUES ($1, $2, 1, 'unequip')
        ON CONFLICT (character_id, item_id)
        DO UPDATE SET quantity = character_inventory.quantity + 1
      `, [charId, currentEquip.rows[0].item_id]);
    }

    // Equipar nuevo item
    await pool.query(`
      INSERT INTO character_equipment (character_id, slot, item_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (character_id, slot)
      DO UPDATE SET item_id = $3, equipped_at = CURRENT_TIMESTAMP
    `, [charId, slot, itemId]);

    // Quitar del inventario
    const newQty = invCheck.rows[0].quantity - 1;
    if (newQty <= 0) {
      await pool.query(
        'DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2',
        [charId, itemId]
      );
    } else {
      await pool.query(
        'UPDATE character_inventory SET quantity = $1 WHERE character_id = $2 AND item_id = $3',
        [newQty, charId, itemId]
      );
    }

    res.json({ success: true, message: `${item.name} equipado en ${slot}` });
  } catch (err) {
    console.error('Error equipping item:', err);
    res.status(500).json({ error: 'Error al equipar item' });
  }
});

// POST /items/equipment/:charId/unequip - Desequipar item
router.post('/equipment/:charId/unequip', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;
    const { slot } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Obtener item equipado
    const equipCheck = await pool.query(`
      SELECT ce.item_id, i.name
      FROM character_equipment ce
      JOIN items i ON ce.item_id = i.id
      WHERE ce.character_id = $1 AND ce.slot = $2
    `, [charId, slot]);

    if (equipCheck.rows.length === 0) {
      return res.status(400).json({ error: 'No hay nada equipado en ese slot' });
    }

    const itemId = equipCheck.rows[0].item_id;
    const itemName = equipCheck.rows[0].name;

    // Devolver al inventario
    await pool.query(`
      INSERT INTO character_inventory (character_id, item_id, quantity, acquired_source)
      VALUES ($1, $2, 1, 'unequip')
      ON CONFLICT (character_id, item_id)
      DO UPDATE SET quantity = character_inventory.quantity + 1
    `, [charId, itemId]);

    // Quitar del equipamiento
    await pool.query(
      'DELETE FROM character_equipment WHERE character_id = $1 AND slot = $2',
      [charId, slot]
    );

    res.json({ success: true, message: `${itemName} desequipado` });
  } catch (err) {
    console.error('Error unequipping item:', err);
    res.status(500).json({ error: 'Error al desequipar item' });
  }
});

// ============================================
// SHOP ENDPOINTS
// ============================================

// GET /items/shops - Listar tiendas
router.get('/shops', async (req, res) => {
  try {
    const pool = req.app.get('db');

    const result = await pool.query(`
      SELECT s.*, COUNT(si.item_id) as item_count
      FROM shops s
      LEFT JOIN shop_inventory si ON s.id = si.shop_id
      WHERE s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.name
    `);

    res.json({ shops: result.rows });
  } catch (err) {
    console.error('Error fetching shops:', err);
    res.status(500).json({ error: 'Error al obtener tiendas' });
  }
});

// GET /items/shops/:code - Tienda con inventario
router.get('/shops/:code', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { code } = req.params;

    // Obtener tienda
    const shopResult = await pool.query(
      'SELECT * FROM shops WHERE code = $1 AND is_active = TRUE',
      [code]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const shop = shopResult.rows[0];

    // Obtener inventario de la tienda
    const invResult = await pool.query(`
      SELECT i.*, si.stock, si.price_override,
             COALESCE(si.price_override, FLOOR(i.base_price * $1)) as buy_price,
             FLOOR(i.base_price * $2) as sell_price
      FROM shop_inventory si
      JOIN items i ON si.item_id = i.id
      WHERE si.shop_id = $3
      AND (si.stock = -1 OR si.stock > 0)
      ORDER BY i.item_type, i.rarity DESC, i.name
    `, [shop.buy_multiplier, shop.sell_multiplier, shop.id]);

    res.json({
      shop,
      inventory: invResult.rows
    });
  } catch (err) {
    console.error('Error fetching shop:', err);
    res.status(500).json({ error: 'Error al obtener tienda' });
  }
});

// POST /items/shops/:code/buy - Comprar item
router.post('/shops/:code/buy', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { code } = req.params;
    const { characterId, itemId, quantity = 1 } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id, gold FROM characters WHERE id = $1 AND user_id = $2',
      [characterId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Obtener tienda
    const shopResult = await pool.query(
      'SELECT * FROM shops WHERE code = $1 AND is_active = TRUE',
      [code]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const shop = shopResult.rows[0];

    // Verificar item en inventario de tienda
    const itemResult = await pool.query(`
      SELECT i.*, si.stock, si.price_override,
             COALESCE(si.price_override, FLOOR(i.base_price * $1)) as price
      FROM shop_inventory si
      JOIN items i ON si.item_id = i.id
      WHERE si.shop_id = $2 AND i.id = $3
    `, [shop.buy_multiplier, shop.id, itemId]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item no disponible en esta tienda' });
    }

    const item = itemResult.rows[0];
    const totalCost = item.price * quantity;

    // Verificar stock
    if (item.stock !== -1 && item.stock < quantity) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    // Verificar oro
    if (charCheck.rows[0].gold < totalCost) {
      return res.status(400).json({ error: 'Oro insuficiente' });
    }

    // Realizar compra
    // 1. Quitar oro
    await pool.query(
      'UPDATE characters SET gold = gold - $1 WHERE id = $2',
      [totalCost, characterId]
    );

    // 2. Agregar item al inventario
    await pool.query(`
      INSERT INTO character_inventory (character_id, item_id, quantity, acquired_source)
      VALUES ($1, $2, $3, 'shop')
      ON CONFLICT (character_id, item_id)
      DO UPDATE SET quantity = character_inventory.quantity + $3
    `, [characterId, itemId, quantity]);

    // 3. Actualizar stock de tienda si no es ilimitado
    if (item.stock !== -1) {
      await pool.query(`
        UPDATE shop_inventory SET stock = stock - $1
        WHERE shop_id = $2 AND item_id = $3
      `, [quantity, shop.id, itemId]);
    }

    // 4. Log de transaccion
    await pool.query(`
      INSERT INTO economy_transactions (character_id, transaction_type, gold_change, item_changes, description)
      VALUES ($1, 'shop_buy', $2, $3, $4)
    `, [
      characterId,
      -totalCost,
      JSON.stringify([{ item_code: item.code, quantity, action: 'add' }]),
      `Compra en ${shop.name}: ${item.name} x${quantity}`
    ]);

    res.json({
      success: true,
      message: `Compraste ${item.name} x${quantity} por ${totalCost} oro`,
      newGold: charCheck.rows[0].gold - totalCost
    });
  } catch (err) {
    console.error('Error buying item:', err);
    res.status(500).json({ error: 'Error al comprar item' });
  }
});

// POST /items/shops/:code/sell - Vender item
router.post('/shops/:code/sell', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { code } = req.params;
    const { characterId, itemId, quantity = 1 } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id, gold FROM characters WHERE id = $1 AND user_id = $2',
      [characterId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Obtener tienda
    const shopResult = await pool.query(
      'SELECT * FROM shops WHERE code = $1 AND is_active = TRUE',
      [code]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const shop = shopResult.rows[0];

    // Verificar item en inventario del personaje
    const invCheck = await pool.query(`
      SELECT ci.quantity, i.*, FLOOR(i.base_price * $1) as sell_price
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = $2 AND ci.item_id = $3
    `, [shop.sell_multiplier, characterId, itemId]);

    if (invCheck.rows.length === 0 || invCheck.rows[0].quantity < quantity) {
      return res.status(400).json({ error: 'No tienes suficientes de ese item' });
    }

    const item = invCheck.rows[0];
    const totalGain = item.sell_price * quantity;

    // Realizar venta
    // 1. Quitar item del inventario
    const newQty = item.quantity - quantity;
    if (newQty <= 0) {
      await pool.query(
        'DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2',
        [characterId, itemId]
      );
    } else {
      await pool.query(
        'UPDATE character_inventory SET quantity = $1 WHERE character_id = $2 AND item_id = $3',
        [newQty, characterId, itemId]
      );
    }

    // 2. Agregar oro
    await pool.query(
      'UPDATE characters SET gold = gold + $1 WHERE id = $2',
      [totalGain, characterId]
    );

    // 3. Log de transaccion
    await pool.query(`
      INSERT INTO economy_transactions (character_id, transaction_type, gold_change, item_changes, description)
      VALUES ($1, 'shop_sell', $2, $3, $4)
    `, [
      characterId,
      totalGain,
      JSON.stringify([{ item_code: item.code, quantity, action: 'remove' }]),
      `Venta en ${shop.name}: ${item.name} x${quantity}`
    ]);

    res.json({
      success: true,
      message: `Vendiste ${item.name} x${quantity} por ${totalGain} oro`,
      newGold: charCheck.rows[0].gold + totalGain
    });
  } catch (err) {
    console.error('Error selling item:', err);
    res.status(500).json({ error: 'Error al vender item' });
  }
});

// ============================================
// CONSUMABLE ENDPOINTS
// ============================================

// POST /items/use/:charId - Usar consumible
router.post('/use/:charId', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;
    const { itemId } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT * FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    const character = charCheck.rows[0];

    // Verificar item en inventario
    const invCheck = await pool.query(`
      SELECT ci.quantity, i.*
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = $1 AND ci.item_id = $2
    `, [charId, itemId]);

    if (invCheck.rows.length === 0) {
      return res.status(400).json({ error: 'No tienes este item' });
    }

    const item = invCheck.rows[0];

    if (!item.is_consumable) {
      return res.status(400).json({ error: 'Este item no es consumible' });
    }

    // Procesar efectos
    const effects = item.effects || [];
    const results = [];
    let hpChange = 0;

    for (const effect of effects) {
      switch (effect.type) {
        case 'heal':
          const healAmount = Math.min(effect.value, character.max_hp - character.hp);
          hpChange += healAmount;
          results.push(`Restauraste ${healAmount} HP`);
          break;
        case 'buff':
          results.push(`+${effect.value} ${effect.stat} por ${effect.duration} turnos`);
          break;
        case 'cure':
          results.push(`Curado de ${effect.condition}`);
          break;
        default:
          results.push(`Efecto: ${effect.type}`);
      }
    }

    // Aplicar curacion si hay
    if (hpChange > 0) {
      await pool.query(
        'UPDATE characters SET hp = LEAST(hp + $1, max_hp) WHERE id = $2',
        [hpChange, charId]
      );
    }

    // Quitar item del inventario
    const newQty = item.quantity - 1;
    if (newQty <= 0) {
      await pool.query(
        'DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2',
        [charId, itemId]
      );
    } else {
      await pool.query(
        'UPDATE character_inventory SET quantity = $1 WHERE character_id = $2 AND item_id = $3',
        [newQty, charId, itemId]
      );
    }

    res.json({
      success: true,
      message: `Usaste ${item.name}`,
      effects: results,
      hpChange,
      newHp: Math.min(character.hp + hpChange, character.max_hp)
    });
  } catch (err) {
    console.error('Error using item:', err);
    res.status(500).json({ error: 'Error al usar item' });
  }
});

// ============================================
// GOLD ENDPOINTS
// ============================================

// POST /items/gold/:charId/add - Agregar oro (sistema/AI)
router.post('/gold/:charId/add', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;
    const { amount, source = 'system' } = req.body;

    // Verificar personaje
    const charCheck = await pool.query(
      'SELECT id, gold FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (charCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    // Actualizar oro
    await pool.query(
      'UPDATE characters SET gold = gold + $1 WHERE id = $2',
      [amount, charId]
    );

    // Log de transaccion
    await pool.query(`
      INSERT INTO economy_transactions (character_id, transaction_type, gold_change, description)
      VALUES ($1, $2, $3, $4)
    `, [charId, source, amount, `Oro ${amount >= 0 ? 'recibido' : 'perdido'}: ${Math.abs(amount)}`]);

    res.json({
      success: true,
      message: `${amount >= 0 ? '+' : ''}${amount} oro`,
      newGold: charCheck.rows[0].gold + amount
    });
  } catch (err) {
    console.error('Error modifying gold:', err);
    res.status(500).json({ error: 'Error al modificar oro' });
  }
});

// GET /items/gold/:charId - Obtener oro del personaje
router.get('/gold/:charId', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { charId } = req.params;

    const result = await pool.query(
      'SELECT gold FROM characters WHERE id = $1 AND user_id = $2',
      [charId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Personaje no autorizado' });
    }

    res.json({ gold: result.rows[0].gold });
  } catch (err) {
    console.error('Error fetching gold:', err);
    res.status(500).json({ error: 'Error al obtener oro' });
  }
});

module.exports = router;
