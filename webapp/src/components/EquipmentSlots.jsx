import React, { useState } from 'react';
import { getRarityStyle, slotNames, slotIcons, formatStatsBonus } from '../utils/itemUtils';
import ItemTooltip from './ItemTooltip';

const SLOTS = ['weapon', 'armor', 'accessory1', 'accessory2'];

export default function EquipmentSlots({ equipment, onUnequip, totalBonus }) {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wide flex items-center gap-2">
          <span>🎽</span> Equipamiento
        </h3>
        {totalBonus && Object.keys(totalBonus).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(totalBonus).map(([stat, value]) => (
              <span
                key={stat}
                className="text-xs px-2 py-0.5 rounded-full bg-neon-green/20 text-neon-green font-medium"
              >
                +{value} {stat.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grid de slots 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {SLOTS.map(slot => {
          const item = equipment[slot];
          const rarityStyle = item ? getRarityStyle(item.rarity) : null;
          const isEmpty = !item;

          return (
            <div
              key={slot}
              className={`relative rounded-xl p-3 transition-all
                ${isEmpty
                  ? 'border-2 border-dashed border-white/20 bg-white/5'
                  : `card-cyber ${rarityStyle.border} border-2 ${item.rarity === 'legendary' ? 'item-legendary' : ''}`
                }`}
              onMouseEnter={() => setHoveredSlot(slot)}
              onMouseLeave={() => setHoveredSlot(null)}
            >
              {isEmpty ? (
                /* Slot vacio */
                <div className="flex flex-col items-center justify-center py-2 text-center">
                  <span className="text-2xl opacity-30">{slotIcons[slot]}</span>
                  <span className="text-xs text-gray-500 mt-1">{slotNames[slot]}</span>
                  <span className="text-xs text-gray-600">(vacio)</span>
                </div>
              ) : (
                /* Slot con item */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.icon_emoji || slotIcons[slot]}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold truncate ${rarityStyle.text}`}>
                        {item.name}
                      </h4>
                      <span className={`text-xs ${rarityStyle.text} opacity-70`}>
                        {slotNames[slot]}
                      </span>
                    </div>
                  </div>

                  {/* Stats del item */}
                  {item.stats_bonus && Object.keys(item.stats_bonus).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formatStatsBonus(item.stats_bonus).map((stat, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green"
                        >
                          +{stat.value} {stat.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Boton desequipar */}
                  {onUnequip && (
                    <button
                      onClick={() => onUnequip(slot)}
                      className="w-full py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                    >
                      Desequipar
                    </button>
                  )}
                </div>
              )}

              {/* Tooltip en hover */}
              {hoveredSlot === slot && item && (
                <ItemTooltip item={item} position="bottom" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
