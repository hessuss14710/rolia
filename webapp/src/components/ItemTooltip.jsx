import React from 'react';
import { getRarityStyle, getTypeIcon, formatStatsBonus, rarityNames, getMainEffect, slotNames } from '../utils/itemUtils';

export default function ItemTooltip({ item, position = 'top' }) {
  const rarityStyle = getRarityStyle(item.rarity);
  const typeIcon = item.icon_emoji || getTypeIcon(item.item_type);
  const statsBonus = formatStatsBonus(item.stats_bonus);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className={`absolute z-50 w-64 glass-strong rounded-xl overflow-hidden animate-scale-in pointer-events-none
        ${positionClasses[position]}`}
    >
      {/* Header */}
      <div className={`p-3 ${rarityStyle.bg} border-b ${rarityStyle.border}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcon}</span>
          <div className="flex-1">
            <h4 className={`font-display font-bold ${rarityStyle.text}`}>
              {item.name}
            </h4>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${rarityStyle.bg} ${rarityStyle.text} border ${rarityStyle.border}`}>
                {rarityNames[item.rarity] || item.rarity}
              </span>
              {item.slot && (
                <span className="text-xs text-gray-400">
                  {slotNames[item.slot] || item.slot}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Descripcion */}
        {item.description && (
          <p className="text-sm text-gray-300 italic">
            {item.description}
          </p>
        )}

        {/* Stats bonus */}
        {statsBonus.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Bonificadores</div>
            <div className="flex flex-wrap gap-1">
              {statsBonus.map((stat, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 rounded-lg bg-neon-green/20 text-neon-green font-medium"
                >
                  +{stat.value} {stat.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Efectos para consumibles */}
        {item.is_consumable && item.effects && item.effects.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Efectos</div>
            <div className="space-y-1">
              {item.effects.map((effect, idx) => (
                <div key={idx} className="text-sm text-cyan-400 flex items-center gap-2">
                  <span className="text-cyan-500">*</span>
                  {getMainEffect([effect])}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requisitos */}
        {item.level_required > 1 && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="text-yellow-500">!</span>
            Requiere nivel {item.level_required}
          </div>
        )}

        {/* Tipo de item */}
        <div className="text-xs text-gray-500 border-t border-white/10 pt-2">
          {item.item_type === 'weapon' && 'Arma'}
          {item.item_type === 'armor' && 'Armadura'}
          {item.item_type === 'accessory' && 'Accesorio'}
          {item.item_type === 'consumable' && 'Consumible'}
          {item.item_type === 'misc' && 'Objeto'}
        </div>
      </div>
    </div>
  );
}
