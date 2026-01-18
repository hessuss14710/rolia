import React, { useState } from 'react';
import { getRarityStyle, getTypeIcon, formatStatsBonus, formatPrice, rarityNames, getMainEffect } from '../utils/itemUtils';
import ItemTooltip from './ItemTooltip';

export default function ItemCard({
  item,
  quantity = 1,
  showPrice = false,
  buyPrice = null,
  sellPrice = null,
  onClick,
  onEquip,
  onUse,
  onSell,
  compact = false,
  selected = false,
  showTooltip = true
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const rarityStyle = getRarityStyle(item.rarity);
  const typeIcon = item.icon_emoji || getTypeIcon(item.item_type);
  const statsBonus = formatStatsBonus(item.stats_bonus);

  const handleClick = () => {
    if (onClick) onClick(item);
  };

  if (compact) {
    return (
      <div
        className={`relative flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all
          ${rarityStyle.bg} ${rarityStyle.border} border
          ${selected ? 'ring-2 ring-neon-purple' : ''}
          hover:scale-[1.02] hover:${rarityStyle.glow}`}
        onClick={handleClick}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
      >
        <span className="text-xl">{typeIcon}</span>
        <span className={`text-sm font-medium ${rarityStyle.text}`}>{item.name}</span>
        {quantity > 1 && (
          <span className="text-xs text-gray-400 ml-auto">x{quantity}</span>
        )}

        {showTooltip && tooltipVisible && (
          <ItemTooltip item={item} />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative card-cyber rounded-xl overflow-hidden transition-all cursor-pointer
        ${rarityStyle.border} border-2
        ${selected ? 'ring-2 ring-neon-purple scale-[1.02]' : ''}
        ${item.rarity === 'legendary' ? 'item-legendary' : ''}
        hover:scale-[1.02]`}
      onClick={handleClick}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      {/* Header con icono y nombre */}
      <div className={`p-3 ${rarityStyle.bg}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <h4 className={`font-display font-bold truncate ${rarityStyle.text}`}>
              {item.name}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${rarityStyle.bg} ${rarityStyle.text} border ${rarityStyle.border}`}>
              {rarityNames[item.rarity] || item.rarity}
            </span>
          </div>
          {quantity > 1 && (
            <span className="text-lg font-bold text-white bg-white/10 px-2 py-1 rounded-lg">
              x{quantity}
            </span>
          )}
        </div>
      </div>

      {/* Body con stats */}
      <div className="p-3 space-y-2">
        {/* Stats bonus */}
        {statsBonus.length > 0 && (
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
        )}

        {/* Efecto para consumibles */}
        {item.is_consumable && item.effects && (
          <div className="text-xs text-cyan-400">
            {getMainEffect(item.effects)}
          </div>
        )}

        {/* Precio */}
        {showPrice && (buyPrice !== null || sellPrice !== null) && (
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            {buyPrice !== null && (
              <div className="flex items-center gap-1 text-sm">
                <span className="gold-display">🪙</span>
                <span className="text-yellow-400 font-bold">{formatPrice(buyPrice)}</span>
              </div>
            )}
            {sellPrice !== null && (
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <span>Venta:</span>
                <span className="gold-display">🪙</span>
                <span>{formatPrice(sellPrice)}</span>
              </div>
            )}
          </div>
        )}

        {/* Botones de accion */}
        {(onEquip || onUse || onSell) && (
          <div className="flex gap-2 pt-2">
            {onEquip && !item.is_consumable && item.slot && (
              <button
                onClick={(e) => { e.stopPropagation(); onEquip(item); }}
                className="flex-1 py-1.5 px-3 text-xs font-bold rounded-lg bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/40 transition-colors"
              >
                Equipar
              </button>
            )}
            {onUse && item.is_consumable && (
              <button
                onClick={(e) => { e.stopPropagation(); onUse(item); }}
                className="flex-1 py-1.5 px-3 text-xs font-bold rounded-lg bg-neon-green/20 text-neon-green hover:bg-neon-green/40 transition-colors"
              >
                Usar
              </button>
            )}
            {onSell && (
              <button
                onClick={(e) => { e.stopPropagation(); onSell(item); }}
                className="py-1.5 px-3 text-xs font-bold rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40 transition-colors"
              >
                🪙
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && tooltipVisible && (
        <ItemTooltip item={item} />
      )}
    </div>
  );
}
