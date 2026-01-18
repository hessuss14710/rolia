import React, { useState } from 'react';

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

export default function CharacterSheet({ character, onClose, onUpdate }) {
  const [showInventory, setShowInventory] = useState(false);
  const [newItem, setNewItem] = useState('');

  function getStatModifier(value) {
    return Math.floor((value - 10) / 2);
  }

  function handleHpChange(delta) {
    const newHp = Math.max(0, Math.min(character.max_hp, character.hp + delta));
    onUpdate({ hp: newHp });
  }

  function handleAddItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;

    const currentInventory = character.inventory || [];
    const updatedInventory = [...currentInventory, { name: newItem.trim(), quantity: 1 }];
    onUpdate({ inventory: updatedInventory });
    setNewItem('');
  }

  function handleRemoveItem(index) {
    const currentInventory = character.inventory || [];
    const item = currentInventory[index];
    if (item.quantity > 1) {
      const updated = [...currentInventory];
      updated[index] = { ...item, quantity: item.quantity - 1 };
      onUpdate({ inventory: updated });
    } else {
      onUpdate({ inventory: currentInventory.filter((_, i) => i !== index) });
    }
  }

  const hpPercentage = (character.hp / character.max_hp) * 100;

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
                {character.class} • Nivel {character.level}
              </div>
            </div>
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
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(character.stats || {}).map(([key, value]) => {
                const mod = getStatModifier(value);
                return (
                  <div key={key} className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-neon-purple/30 transition-colors">
                    <div className="text-lg mb-1">{statIcons[key] || '📌'}</div>
                    <div className="text-xs text-gray-400 mb-1">{statNames[key] || key}</div>
                    <div className="font-display font-bold text-2xl">{value}</div>
                    <div className={`text-xs font-bold ${mod >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                      {mod >= 0 ? '+' : ''}{mod}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                {(character.inventory || []).length} objetos
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
              {(character.inventory || []).length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  <div className="text-4xl mb-2 opacity-50">📦</div>
                  Inventario vacio
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(character.inventory || []).map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 hover:bg-white/10 transition-colors"
                    >
                      <span className="font-medium">
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="text-neon-purple ml-2 text-sm">x{item.quantity}</span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddItem} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Nuevo objeto..."
                  className="input-cyber flex-1"
                />
                <button
                  type="submit"
                  disabled={!newItem.trim()}
                  className="btn-neon px-6 disabled:opacity-30"
                >
                  +
                </button>
              </form>
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
    </div>
  );
}
