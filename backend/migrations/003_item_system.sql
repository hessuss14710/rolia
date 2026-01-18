-- ============================================
-- Migration 003: Item System
-- Sistema completo de items, equipamiento y tiendas
-- ============================================

-- Catalogo maestro de items
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    item_type VARCHAR(50) NOT NULL,          -- 'weapon', 'armor', 'consumable', 'accessory', 'misc'
    rarity VARCHAR(20) DEFAULT 'common',     -- 'common', 'rare', 'epic', 'legendary'
    slot VARCHAR(30),                        -- 'weapon', 'armor', 'accessory1', 'accessory2', NULL para consumibles
    icon_emoji VARCHAR(10),
    stats_bonus JSONB DEFAULT '{}',          -- {"str": 2, "dex": 1, "max_hp": 10}
    effects JSONB DEFAULT '[]',              -- [{"type": "heal", "value": 20}]
    base_price INTEGER DEFAULT 0,
    is_consumable BOOLEAN DEFAULT FALSE,
    level_required INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tiendas/NPCs vendedores
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    npc_name VARCHAR(255),
    description TEXT,
    icon_emoji VARCHAR(10) DEFAULT '🏪',
    buy_multiplier DECIMAL(3,2) DEFAULT 1.00,   -- Precio de compra = base_price * buy_multiplier
    sell_multiplier DECIMAL(3,2) DEFAULT 0.50,  -- Precio de venta = base_price * sell_multiplier
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventario de tiendas (que items vende cada tienda)
CREATE TABLE shop_inventory (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    stock INTEGER DEFAULT -1,                -- -1 = ilimitado
    price_override INTEGER,                  -- NULL = usar base_price * multiplier
    UNIQUE(shop_id, item_id)
);

-- Agregar oro a personajes
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gold INTEGER DEFAULT 100;

-- Inventario mejorado del personaje (items del catalogo)
CREATE TABLE character_inventory (
    id SERIAL PRIMARY KEY,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acquired_source VARCHAR(100),            -- 'shop', 'loot', 'quest', 'ai_reward'
    UNIQUE(character_id, item_id)
);

-- Equipamiento del personaje
CREATE TABLE character_equipment (
    id SERIAL PRIMARY KEY,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    slot VARCHAR(30) NOT NULL,               -- 'weapon', 'armor', 'accessory1', 'accessory2'
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    equipped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(character_id, slot)
);

-- Log de transacciones economicas
CREATE TABLE economy_transactions (
    id SERIAL PRIMARY KEY,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,   -- 'shop_buy', 'shop_sell', 'loot', 'quest_reward', 'ai_reward'
    gold_change INTEGER DEFAULT 0,
    item_changes JSONB DEFAULT '[]',         -- [{"item_code": "sword_basic", "quantity": 1, "action": "add"}]
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices para mejor rendimiento
CREATE INDEX idx_character_inventory_char ON character_inventory(character_id);
CREATE INDEX idx_character_equipment_char ON character_equipment(character_id);
CREATE INDEX idx_economy_transactions_char ON economy_transactions(character_id);
CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_rarity ON items(rarity);
CREATE INDEX idx_shop_inventory_shop ON shop_inventory(shop_id);

-- ============================================
-- SEED DATA: Items basicos
-- ============================================

-- Armas
INSERT INTO items (code, name, description, item_type, rarity, slot, icon_emoji, stats_bonus, base_price, level_required) VALUES
('sword_basic', 'Espada de Hierro', 'Una espada sencilla pero confiable.', 'weapon', 'common', 'weapon', '🗡️', '{"str": 2}', 50, 1),
('sword_steel', 'Espada de Acero', 'Forjada con acero de calidad, mas resistente y afilada.', 'weapon', 'rare', 'weapon', '⚔️', '{"str": 4, "dex": 1}', 150, 3),
('sword_flame', 'Espada Flamigera', 'Arde con un fuego magico que nunca se extingue.', 'weapon', 'epic', 'weapon', '🔥', '{"str": 6, "int": 2}', 500, 5),
('sword_legend', 'Excalibur', 'La legendaria espada de los reyes. Otorga poder y carisma incomparables.', 'weapon', 'legendary', 'weapon', '✨', '{"str": 10, "cha": 5, "max_hp": 20}', 5000, 10),
('dagger_basic', 'Daga de Cobre', 'Pequena pero letal en las manos adecuadas.', 'weapon', 'common', 'weapon', '🔪', '{"dex": 2}', 30, 1),
('dagger_poison', 'Daga Envenenada', 'Su filo esta impregnado de un veneno mortal.', 'weapon', 'rare', 'weapon', '🗡️', '{"dex": 4, "str": 1}', 200, 4),
('staff_basic', 'Baston de Madera', 'Un baston simple para canalizar magia.', 'weapon', 'common', 'weapon', '🪄', '{"int": 2}', 40, 1),
('staff_arcane', 'Baston Arcano', 'Pulsa con energia magica contenida.', 'weapon', 'epic', 'weapon', '🔮', '{"int": 6, "wis": 3}', 600, 6),
('bow_basic', 'Arco Corto', 'Un arco ligero para principiantes.', 'weapon', 'common', 'weapon', '🏹', '{"dex": 2}', 45, 1),
('bow_elven', 'Arco Elfico', 'Tallado por maestros elficos, nunca falla.', 'weapon', 'epic', 'weapon', '🎯', '{"dex": 6, "wis": 2}', 550, 5);

-- Armaduras
INSERT INTO items (code, name, description, item_type, rarity, slot, icon_emoji, stats_bonus, base_price, level_required) VALUES
('armor_leather', 'Armadura de Cuero', 'Ligera y flexible, ideal para exploradores.', 'armor', 'common', 'armor', '🥋', '{"con": 1, "max_hp": 5}', 40, 1),
('armor_chain', 'Cota de Malla', 'Ofrece buena proteccion sin sacrificar movilidad.', 'armor', 'rare', 'armor', '⛓️', '{"con": 3, "max_hp": 15}', 180, 3),
('armor_plate', 'Armadura de Placas', 'Proteccion maxima para el guerrero valiente.', 'armor', 'epic', 'armor', '🛡️', '{"con": 5, "str": 2, "max_hp": 30}', 800, 6),
('armor_dragon', 'Armadura de Escamas de Dragon', 'Forjada con escamas de un dragon ancestral.', 'armor', 'legendary', 'armor', '🐉', '{"con": 8, "str": 4, "max_hp": 50}', 6000, 12),
('robe_basic', 'Tunica de Mago', 'Una tunica sencilla que facilita el flujo de mana.', 'armor', 'common', 'armor', '👘', '{"int": 1, "wis": 1}', 35, 1),
('robe_archmage', 'Tunica del Archimago', 'Tejida con hilos de luz de luna.', 'armor', 'epic', 'armor', '🌟', '{"int": 4, "wis": 4, "max_hp": 10}', 750, 7);

-- Accesorios
INSERT INTO items (code, name, description, item_type, rarity, slot, icon_emoji, stats_bonus, base_price, level_required) VALUES
('ring_power', 'Anillo de Poder', 'Aumenta la fuerza fisica del portador.', 'accessory', 'rare', 'accessory1', '💍', '{"str": 3}', 100, 2),
('ring_wisdom', 'Anillo de Sabiduria', 'Clarifica la mente y agudiza los sentidos.', 'accessory', 'rare', 'accessory1', '💎', '{"wis": 3}', 100, 2),
('ring_protection', 'Anillo de Proteccion', 'Genera un campo de fuerza invisible.', 'accessory', 'epic', 'accessory1', '🔵', '{"con": 2, "max_hp": 15}', 300, 4),
('amulet_health', 'Amuleto de Vitalidad', 'Pulsa con energia vital.', 'accessory', 'rare', 'accessory2', '❤️', '{"max_hp": 20}', 120, 2),
('amulet_mana', 'Amuleto de Mana', 'Aumenta las reservas magicas.', 'accessory', 'rare', 'accessory2', '💠', '{"int": 2, "wis": 2}', 130, 3),
('amulet_luck', 'Amuleto de la Suerte', 'Dicen que fue bendecido por los dioses de la fortuna.', 'accessory', 'epic', 'accessory2', '🍀', '{"cha": 3}', 250, 3),
('pendant_shadow', 'Colgante de las Sombras', 'Permite moverse sin ser detectado.', 'accessory', 'legendary', 'accessory2', '🌑', '{"dex": 6, "wis": 3}', 2000, 8),
('belt_giant', 'Cinturon del Gigante', 'Otorga fuerza sobrehumana.', 'accessory', 'legendary', 'accessory1', '⚡', '{"str": 8, "con": 4}', 3000, 10);

-- Consumibles
INSERT INTO items (code, name, description, item_type, rarity, icon_emoji, effects, base_price, is_consumable, level_required) VALUES
('potion_health', 'Pocion de Vida', 'Restaura 20 puntos de vida.', 'consumable', 'common', '🧪', '[{"type": "heal", "value": 20}]', 25, TRUE, 1),
('potion_health_greater', 'Pocion de Vida Mayor', 'Restaura 50 puntos de vida.', 'consumable', 'rare', '❤️‍🔥', '[{"type": "heal", "value": 50}]', 75, TRUE, 3),
('potion_health_supreme', 'Elixir de Vida Supremo', 'Restaura 100 puntos de vida.', 'consumable', 'epic', '💖', '[{"type": "heal", "value": 100}]', 200, TRUE, 6),
('potion_strength', 'Pocion de Fuerza', 'Aumenta la fuerza temporalmente.', 'consumable', 'rare', '💪', '[{"type": "buff", "stat": "str", "value": 4, "duration": 3}]', 60, TRUE, 2),
('potion_speed', 'Pocion de Velocidad', 'Aumenta la agilidad temporalmente.', 'consumable', 'rare', '⚡', '[{"type": "buff", "stat": "dex", "value": 4, "duration": 3}]', 60, TRUE, 2),
('scroll_fireball', 'Pergamino de Bola de Fuego', 'Lanza una devastadora bola de fuego.', 'consumable', 'rare', '📜', '[{"type": "damage", "element": "fire", "value": 30}]', 100, TRUE, 4),
('antidote', 'Antidoto', 'Cura cualquier veneno.', 'consumable', 'common', '🧴', '[{"type": "cure", "condition": "poison"}]', 15, TRUE, 1),
('ration_travel', 'Racion de Viaje', 'Comida para un dia de viaje.', 'consumable', 'common', '🍖', '[{"type": "sustenance", "days": 1}]', 5, TRUE, 1);

-- Items miscelaneos
INSERT INTO items (code, name, description, item_type, rarity, icon_emoji, base_price, level_required) VALUES
('gem_ruby', 'Rubi', 'Una gema preciosa de color rojo intenso.', 'misc', 'rare', '🔴', 150, 1),
('gem_sapphire', 'Zafiro', 'Una gema azul de gran pureza.', 'misc', 'rare', '🔵', 150, 1),
('gem_emerald', 'Esmeralda', 'Una gema verde brillante.', 'misc', 'rare', '🟢', 150, 1),
('gem_diamond', 'Diamante', 'La gema mas preciada de todas.', 'misc', 'epic', '💎', 500, 1),
('key_rusty', 'Llave Oxidada', 'Una llave vieja. Quien sabe que abrira.', 'misc', 'common', '🗝️', 10, 1),
('key_golden', 'Llave Dorada', 'Una llave de oro puro. Abre algo importante.', 'misc', 'epic', '🔑', 300, 1),
('map_treasure', 'Mapa del Tesoro', 'Marca la ubicacion de un tesoro escondido.', 'misc', 'epic', '🗺️', 200, 1),
('coin_ancient', 'Moneda Antigua', 'Una reliquia de una civilizacion perdida.', 'misc', 'rare', '🪙', 75, 1),
('skull_crystal', 'Calavera de Cristal', 'Emite un brillo misterioso. Se dice que contiene secretos antiguos.', 'misc', 'legendary', '💀', 2500, 1),
('torch', 'Antorcha', 'Ilumina el camino en la oscuridad.', 'misc', 'common', '🔥', 5, 1),
('rope', 'Cuerda (15m)', 'Util para escalar o atar cosas.', 'misc', 'common', '🧵', 10, 1);

-- ============================================
-- SEED DATA: Tienda general
-- ============================================

INSERT INTO shops (code, name, npc_name, description, icon_emoji, buy_multiplier, sell_multiplier) VALUES
('general_store', 'Tienda del Pueblo', 'Marcus el Mercader', 'Una tienda general con todo lo que un aventurero necesita.', '🏪', 1.00, 0.50),
('blacksmith', 'Forja del Hierro Candente', 'Grom el Herrero', 'Armas y armaduras de la mejor calidad.', '⚒️', 1.20, 0.60),
('alchemist', 'El Caldero Burbujeante', 'Lyra la Alquimista', 'Pociones, elixires y brebajes magicos.', '⚗️', 1.10, 0.40),
('jeweler', 'Joyas del Alba', 'Elena la Joyera', 'Accesorios magicos y gemas preciosas.', '💍', 1.30, 0.70);

-- Inventario de tienda general
INSERT INTO shop_inventory (shop_id, item_id, stock)
SELECT s.id, i.id, -1
FROM shops s, items i
WHERE s.code = 'general_store'
AND i.code IN ('potion_health', 'antidote', 'ration_travel', 'torch', 'rope', 'armor_leather', 'sword_basic', 'dagger_basic');

-- Inventario de herreria
INSERT INTO shop_inventory (shop_id, item_id, stock)
SELECT s.id, i.id, -1
FROM shops s, items i
WHERE s.code = 'blacksmith'
AND i.code IN ('sword_basic', 'sword_steel', 'dagger_basic', 'dagger_poison', 'bow_basic', 'armor_leather', 'armor_chain', 'armor_plate');

-- Inventario de alquimista
INSERT INTO shop_inventory (shop_id, item_id, stock)
SELECT s.id, i.id, -1
FROM shops s, items i
WHERE s.code = 'alchemist'
AND i.code IN ('potion_health', 'potion_health_greater', 'potion_health_supreme', 'potion_strength', 'potion_speed', 'antidote');

-- Inventario de joyeria (stock limitado para items raros)
INSERT INTO shop_inventory (shop_id, item_id, stock)
SELECT s.id, i.id,
    CASE
        WHEN i.rarity = 'legendary' THEN 1
        WHEN i.rarity = 'epic' THEN 2
        ELSE -1
    END
FROM shops s, items i
WHERE s.code = 'jeweler'
AND i.code IN ('ring_power', 'ring_wisdom', 'ring_protection', 'amulet_health', 'amulet_mana', 'amulet_luck', 'gem_ruby', 'gem_sapphire', 'gem_emerald', 'gem_diamond');

-- Confirmacion
DO $$
BEGIN
    RAISE NOTICE 'Migration 003: Item System completada';
    RAISE NOTICE 'Tablas creadas: items, shops, shop_inventory, character_inventory, character_equipment, economy_transactions';
    RAISE NOTICE 'Items insertados: %', (SELECT COUNT(*) FROM items);
    RAISE NOTICE 'Tiendas insertadas: %', (SELECT COUNT(*) FROM shops);
END $$;
