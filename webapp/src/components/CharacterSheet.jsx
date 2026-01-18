import React, { useState } from 'react';

const statNames = {
  str: 'FUE',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
  tech: 'TEC',
  combat: 'COM',
  pilot: 'PIL',
  science: 'CIE',
  social: 'SOC',
  survival: 'SUP',
  fuerza: 'FUE',
  agilidad: 'AGI',
  resistencia: 'RES',
  percepcion: 'PER',
  voluntad: 'VOL',
  cordura: 'COR',
  cuerpo: 'CUE',
  reflejos: 'REF',
  tecnica: 'TEC',
  inteligencia: 'INT',
  carisma: 'CAR',
  suerte: 'SUE',
  navegacion: 'NAV',
  punteria: 'PUN'
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
  const hpColor = hpPercentage > 50 ? 'bg-green-500' : hpPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50">
      <div className="glass rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold">{character.name}</h2>
            <div className="text-sm text-gray-400">
              {character.class} • Nivel {character.level}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* HP Bar */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Puntos de Vida</span>
              <span className="font-bold">{character.hp} / {character.max_hp}</span>
            </div>
            <div className="h-4 bg-white/10 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full ${hpColor} transition-all`}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleHpChange(-1)}
                className="flex-1 bg-red-600/30 hover:bg-red-600/50 py-2 rounded-lg text-red-300"
              >
                -1 HP
              </button>
              <button
                onClick={() => handleHpChange(-5)}
                className="bg-red-600/30 hover:bg-red-600/50 px-4 py-2 rounded-lg text-red-300"
              >
                -5
              </button>
              <button
                onClick={() => handleHpChange(5)}
                className="bg-green-600/30 hover:bg-green-600/50 px-4 py-2 rounded-lg text-green-300"
              >
                +5
              </button>
              <button
                onClick={() => handleHpChange(1)}
                className="flex-1 bg-green-600/30 hover:bg-green-600/50 py-2 rounded-lg text-green-300"
              >
                +1 HP
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm text-gray-400 mb-3">Estadisticas</h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(character.stats || {}).map(([key, value]) => {
                const mod = getStatModifier(value);
                return (
                  <div key={key} className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-400">{statNames[key] || key}</div>
                    <div className="text-xl font-bold">{value}</div>
                    <div className={`text-xs ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
            className="w-full bg-white/5 hover:bg-white/10 rounded-xl p-4 flex items-center justify-between"
          >
            <span className="font-semibold">Inventario</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
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
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              {(character.inventory || []).length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  Inventario vacio
                </div>
              ) : (
                <div className="space-y-2">
                  {(character.inventory || []).map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                    >
                      <span>
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="text-gray-400 ml-1">x{item.quantity}</span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddItem} className="flex gap-2">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Nuevo objeto..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={!newItem.trim()}
                  className="bg-rolia-600 hover:bg-rolia-500 disabled:bg-gray-700 px-4 py-2 rounded-lg"
                >
                  +
                </button>
              </form>
            </div>
          )}

          {/* Background */}
          {character.background && (
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="text-sm text-gray-400 mb-2">Historia</h3>
              <p className="text-sm whitespace-pre-wrap">{character.background}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
