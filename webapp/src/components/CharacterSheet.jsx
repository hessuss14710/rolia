import React, { useState, useEffect } from 'react';
import api from '../services/api';
import EquipmentSlots from './EquipmentSlots';
import ItemCard from './ItemCard';
import ShopModal from './ShopModal';
import { formatPrice, sortItems, filterItemsByType, calculateEquippedStats } from '../utils/itemUtils';

const statNames = {
  str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR',
  tech: 'TEC', combat: 'COM', pilot: 'PIL', science: 'CIE', social: 'SOC', survival: 'SUP',
  fuerza: 'FUE', agilidad: 'AGI', resistencia: 'RES', percepcion: 'PER', voluntad: 'VOL', cordura: 'COR',
  cuerpo: 'CUE', reflejos: 'REF', tecnica: 'TEC', inteligencia: 'INT', carisma: 'CAR', suerte: 'SUE',
  navegacion: 'NAV', punteria: 'PUN'
};

const statIcons = {
  str: '💪', dex: '🏃', con: '🛡️', int: '🧠', wis: '👁️', cha: '💬',
  tech: '🔧', combat: '⚔️', pilot: '🚀', science: '🔬', social: '🤝', survival: '🏕️',
  fuerza: '💪', agilidad: '🏃', resistencia: '🛡️', percepcion: '👁️', voluntad: '🧠', cordura: '😰',
  cuerpo: '💪', reflejos: '⚡', tecnica: '🔧', inteligencia: '🧠', carisma: '💬', suerte: '🍀',
  navegacion: '🧭', punteria: '🎯'
};

const ITEM_TYPE_TABS = [
  { key: 'all', label: 'Todo', icon: '📦' },
  { key: 'weapon', label: 'Armas', icon: '⚔️' },
  { key: 'armor', label: 'Armadura', icon: '🛡️' },
  { key: 'accessory', label: 'Accesorios', icon: '💍' },
  { key: 'consumable', label: 'Consumibles', icon: '🧪' }
];

export default function CharacterSheet({ character, onClose, onUpdate }) {
  const [showInventory, setShowInventory] = useState(false);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showShop, setShowShop] = useState(false);
  const [selectedShop, setSelectedShop] = useState('general_store');
  const [inventoryFilter, setInventoryFilter] = useState('all');

  // Estado del sistema de items
  const [inventory, setInventory] = useState([]);
  const [equipment, setEquipment] = useState({ weapon: null, armor: null, accessory1: null, accessory2: null });
  const [totalBonus, setTotalBonus] = useState({});
  const [gold, setGold] = useState(character.gold || 100);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Cargar inventario y equipamiento
  useEffect(() => {
    if (character?.id) {
      loadItemData();
    }
  }, [character?.id]);

  async function loadItemData() {
    try {
      setLoading(true);
      const [invData, equipData] = await Promise.all([
        api.getCharacterInventory(character.id),
        api.getCharacterEquipment(character.id)
      ]);

      setInventory(invData.inventory || []);
      setGold(invData.gold || 0);
      setEquipment(equipData.equipment || { weapon: null, armor: null, accessory1: null, accessory2: null });
      setTotalBonus(equipData.totalBonus || {});
    } catch (err) {
      console.error('Error loading item data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getStatModifier(value) {
    return Math.floor((value - 10) / 2);
  }

  function handleHpChange(delta) {
    const newHp = Math.max(0, Math.min(character.max_hp, character.hp + delta));
    onUpdate({ hp: newHp });
  }

  async function handleEquipItem(item) {
    try {
      // Determinar slot
      let slot = item.slot;
      if (slot === 'accessory1' || slot === 'accessory2') {
        // Si accessory1 esta ocupado, usar accessory2
        slot = equipment.accessory1 ? 'accessory2' : 'accessory1';
      }

      await api.equipItem(character.id, item.item_id, slot);
      setMessage({ type: 'success', text: `${item.name} equipado` });
      loadItemData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleUnequipItem(slot) {
    try {
      await api.unequipItem(character.id, slot);
      setMessage({ type: 'success', text: 'Item desequipado' });
      loadItemData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleUseItem(item) {
    try {
      const result = await api.useItem(character.id, item.item_id);
      setMessage({ type: 'success', text: result.message });

      // Actualizar HP si hubo curacion
      if (result.hpChange && result.newHp !== undefined) {
        onUpdate({ hp: result.newHp });
      }

      loadItemData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  // Limpiar mensaje despues de 3 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Calcular stats con bonificadores de equipo
  const effectiveStats = calculateEquippedStats(character.stats || {}, equipment);

  const hpPercentage = (character.hp / character.max_hp) * 100;

  // Filtrar inventario
  const filteredInventory = filterItemsByType(sortItems(inventory), inventoryFilter);

  return (
    <div className="fixed inset-0 modal-overlay flex items-end sm:items-center justify-center z-50">
      <div className="glass rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-neon-purple/10 to-neon-pink/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 border border-neon-purple/50 flex items-center justify-center text-3xl">
              🧙
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{character.name}</h2>
              <div className="text-sm text-gray-400">
                {character.class} - Nivel {character.level}
              </div>
            </div>
          </div>

          {/* Gold display */}
          <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1.5 rounded-xl border border-yellow-500/30">
            <span className="text-lg gold-display">🪙</span>
            <span className="font-bold text-yellow-400">{formatPrice(gold)}</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`mx-4 mt-4 p-3 rounded-xl text-sm font-medium animate-fade-in
            ${message.type === 'success' ? 'bg-neon-green/20 text-neon-green' : 'bg-red-500/20 text-red-400'}`}
          >
            {message.text}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* HP Bar */}
          <div className="card-cyber rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400 font-medium uppercase tracking-wide flex items-center gap-2">
                <span>❤️</span> Puntos de Vida
              </span>
              <span className="font-display font-bold text-xl">
                <span className={hpPercentage > 50 ? 'text-neon-green' : hpPercentage > 25 ? 'text-yellow-500' : 'text-red-500'}>
                  {character.hp}
                </span>
                <span className="text-gray-500"> / {character.max_hp}</span>
              </span>
            </div>
            <div className="stat-bar h-4 mb-4">
              <div
                className={`stat-bar-fill ${hpPercentage > 50 ? 'hp-full' : hpPercentage > 25 ? 'hp-medium' : 'hp-low'}`}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleHpChange(-5)}
                className="py-2 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-300 font-bold transition-colors"
              >
                -5
              </button>
              <button
                onClick={() => handleHpChange(-1)}
                className="py-2 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-300 font-bold transition-colors"
              >
                -1
              </button>
              <button
                onClick={() => handleHpChange(1)}
                className="py-2 rounded-xl bg-neon-green/20 hover:bg-neon-green/40 text-neon-green font-bold transition-colors"
              >
                +1
              </button>
              <button
                onClick={() => handleHpChange(5)}
                className="py-2 rounded-xl bg-neon-green/20 hover:bg-neon-green/40 text-neon-green font-bold transition-colors"
              >
                +5
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="card-cyber rounded-2xl p-5">
            <h3 className="text-sm text-gray-400 mb-4 font-medium uppercase tracking-wide flex items-center gap-2">
              <span>📊</span> Estadisticas
              {Object.keys(totalBonus).length > 0 && (
                <span className="text-xs text-neon-green">(con equipo)</span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(character.stats || {}).map(([key, baseValue]) => {
                const bonus = totalBonus[key] || 0;
                const totalValue = baseValue + bonus;
                const mod = getStatModifier(totalValue);
                return (
                  <div key={key} className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-neon-purple/30 transition-colors">
                    <div className="text-lg mb-1">{statIcons[key] || '📌'}</div>
                    <div className="text-xs text-gray-400 mb-1">{statNames[key] || key}</div>
                    <div className="font-display font-bold text-2xl">
                      {totalValue}
                      {bonus > 0 && (
                        <span className="text-xs text-neon-green ml-1">+{bonus}</span>
                      )}
                    </div>
                    <div className={`text-xs font-bold ${mod >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                      {mod >= 0 ? '+' : ''}{mod}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipment Toggle */}
          <button
            onClick={() => setShowEquipment(!showEquipment)}
            className="w-full card-cyber rounded-2xl p-4 flex items-center justify-between hover:border-neon-purple/50 transition-colors"
          >
            <span className="font-display font-bold flex items-center gap-2">
              <span>🎽</span> Equipamiento
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showEquipment ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Equipment Content */}
          {showEquipment && (
            <div className="card-cyber rounded-2xl p-5 animate-fade-in">
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="spinner" />
                </div>
              ) : (
                <EquipmentSlots
                  equipment={equipment}
                  totalBonus={totalBonus}
                  onUnequip={handleUnequipItem}
                />
              )}
            </div>
          )}

          {/* Inventory Toggle */}
          <button
            onClick={() => setShowInventory(!showInventory)}
            className="w-full card-cyber rounded-2xl p-4 flex items-center justify-between hover:border-neon-purple/50 transition-colors"
          >
            <span className="font-display font-bold flex items-center gap-2">
              <span>🎒</span> Inventario
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 bg-white/10 px-2 py-1 rounded-lg">
                {inventory.length} objetos
              </span>
              <svg
                className={`w-5 h-5 transition-transform ${showInventory ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Inventory Content */}
          {showInventory && (
            <div className="card-cyber rounded-2xl p-5 space-y-3 animate-fade-in">
              {/* Filtros */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {ITEM_TYPE_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setInventoryFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                      ${inventoryFilter === tab.key
                        ? 'bg-neon-purple text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="spinner" />
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  <div className="text-4xl mb-2 opacity-50">📦</div>
                  {inventoryFilter === 'all' ? 'Inventario vacio' : 'No hay items de este tipo'}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredInventory.map((item) => (
                    <ItemCard
                      key={item.item_id}
                      item={item}
                      quantity={item.quantity}
                      compact={true}
                      onEquip={item.slot && !item.is_consumable ? handleEquipItem : null}
                      onUse={item.is_consumable ? handleUseItem : null}
                    />
                  ))}
                </div>
              )}

              {/* Boton de tienda */}
              <button
                onClick={() => setShowShop(true)}
                className="w-full py-3 mt-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 hover:border-yellow-500/50 text-yellow-400 font-display font-bold flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-yellow-500/20"
              >
                <span className="text-xl">🏪</span> Abrir Tienda
              </button>
            </div>
          )}

          {/* Background */}
          {character.background && (
            <div className="card-cyber rounded-2xl p-5">
              <h3 className="text-sm text-gray-400 mb-3 font-medium uppercase tracking-wide flex items-center gap-2">
                <span>📜</span> Historia
              </h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-300">{character.background}</p>
            </div>
          )}
        </div>
      </div>

      {/* Shop Modal */}
      {showShop && (
        <ShopModal
          shopCode={selectedShop}
          characterId={character.id}
          gold={gold}
          onClose={() => setShowShop(false)}
          onGoldChange={setGold}
          onInventoryChange={loadItemData}
        />
      )}
    </div>
  );
}
