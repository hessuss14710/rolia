// Iconos por tipo de item
export const itemTypeIcons = {
  weapon: '⚔️',
  armor: '🛡️',
  consumable: '🧪',
  accessory: '💍',
  misc: '📦'
};

// Colores por rareza (tema cyberpunk)
export const rarityColors = {
  common: {
    text: 'text-gray-400',
    bg: 'bg-gray-500/20',
    border: 'border-gray-500/30',
    glow: '',
    gradient: 'from-gray-500 to-gray-600'
  },
  rare: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
    glow: 'shadow-lg shadow-blue-500/20',
    gradient: 'from-blue-500 to-cyan-500'
  },
  epic: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/40',
    glow: 'shadow-lg shadow-purple-500/30',
    gradient: 'from-purple-500 to-pink-500'
  },
  legendary: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/40',
    glow: 'shadow-lg shadow-yellow-500/40 item-legendary',
    gradient: 'from-yellow-500 to-orange-500'
  }
};

// Nombres de rareza en espanol
export const rarityNames = {
  common: 'Comun',
  rare: 'Raro',
  epic: 'Epico',
  legendary: 'Legendario'
};

// Nombres de slots en espanol
export const slotNames = {
  weapon: 'Arma',
  armor: 'Armadura',
  accessory1: 'Accesorio 1',
  accessory2: 'Accesorio 2'
};

// Iconos de slots
export const slotIcons = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory1: '💍',
  accessory2: '📿'
};

// Nombres de stats en espanol
export const statNames = {
  str: 'FUE',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
  max_hp: 'HP Max'
};

// Obtener color de rareza para un item
export function getRarityStyle(rarity) {
  return rarityColors[rarity] || rarityColors.common;
}

// Obtener icono de tipo
export function getTypeIcon(itemType) {
  return itemTypeIcons[itemType] || '📦';
}

// Formatear stats bonus para mostrar
export function formatStatsBonus(statsBonus) {
  if (!statsBonus || Object.keys(statsBonus).length === 0) return [];

  return Object.entries(statsBonus).map(([stat, value]) => ({
    stat,
    name: statNames[stat] || stat.toUpperCase(),
    value,
    display: `+${value} ${statNames[stat] || stat.toUpperCase()}`
  }));
}

// Formatear precio con separador de miles
export function formatPrice(price) {
  if (price === undefined || price === null) return '0';
  return price.toLocaleString('es-ES');
}

// Calcular stats totales con equipo
export function calculateEquippedStats(baseStats, equipment) {
  const totalStats = { ...baseStats };

  Object.values(equipment).forEach(item => {
    if (item && item.stats_bonus) {
      Object.entries(item.stats_bonus).forEach(([stat, value]) => {
        if (stat === 'max_hp') {
          totalStats.max_hp = (totalStats.max_hp || 0) + value;
        } else {
          totalStats[stat] = (totalStats[stat] || 0) + value;
        }
      });
    }
  });

  return totalStats;
}

// Verificar si un item puede equiparse en un slot
export function canEquipInSlot(item, slot) {
  if (!item || !item.slot) return false;

  // Accesorios pueden ir en accessory1 o accessory2
  if (item.slot.startsWith('accessory') && slot.startsWith('accessory')) {
    return true;
  }

  return item.slot === slot;
}

// Ordenar items por rareza y tipo
export function sortItems(items) {
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const typeOrder = { weapon: 0, armor: 1, accessory: 2, consumable: 3, misc: 4 };

  return [...items].sort((a, b) => {
    const rarityDiff = (rarityOrder[a.rarity] || 4) - (rarityOrder[b.rarity] || 4);
    if (rarityDiff !== 0) return rarityDiff;

    const typeDiff = (typeOrder[a.item_type] || 5) - (typeOrder[b.item_type] || 5);
    if (typeDiff !== 0) return typeDiff;

    return a.name.localeCompare(b.name);
  });
}

// Filtrar items por tipo
export function filterItemsByType(items, type) {
  if (!type || type === 'all') return items;
  return items.filter(item => item.item_type === type);
}

// Obtener efecto principal de un consumible
export function getMainEffect(effects) {
  if (!effects || effects.length === 0) return null;

  const effect = effects[0];
  switch (effect.type) {
    case 'heal':
      return `Restaura ${effect.value} HP`;
    case 'buff':
      return `+${effect.value} ${statNames[effect.stat] || effect.stat} (${effect.duration} turnos)`;
    case 'damage':
      return `${effect.value} daño ${effect.element || ''}`;
    case 'cure':
      return `Cura ${effect.condition}`;
    default:
      return effect.type;
  }
}
