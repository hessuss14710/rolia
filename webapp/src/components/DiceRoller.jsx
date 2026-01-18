import React, { useState } from 'react';

const DICE_TYPES = [
  { value: 'd4', label: 'D4', icon: '◆', color: 'from-green-500 to-emerald-600' },
  { value: 'd6', label: 'D6', icon: '⬡', color: 'from-blue-500 to-cyan-600' },
  { value: 'd8', label: 'D8', icon: '◇', color: 'from-purple-500 to-violet-600' },
  { value: 'd10', label: 'D10', icon: '◈', color: 'from-pink-500 to-rose-600' },
  { value: 'd12', label: 'D12', icon: '⬢', color: 'from-orange-500 to-amber-600' },
  { value: 'd20', label: 'D20', icon: '⬟', color: 'from-neon-purple to-neon-pink' },
  { value: 'd100', label: 'D100', icon: '◉', color: 'from-red-500 to-orange-600' }
];

export default function DiceRoller({ onRoll, onClose }) {
  const [selectedDice, setSelectedDice] = useState('d20');
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [reason, setReason] = useState('');
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);

  const selectedDiceData = DICE_TYPES.find(d => d.value === selectedDice);

  function handleRoll() {
    setRolling(true);
    setResult(null);

    const match = selectedDice.match(/d(\d+)/);
    const sides = parseInt(match[1], 10);
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * sides) + 1);
    }
    const total = results.reduce((a, b) => a + b, 0) + modifier;

    setTimeout(() => {
      setResult({ results, total });
      setRolling(false);
    }, 600);
  }

  function handleConfirm() {
    onRoll(`${count}${selectedDice}`, modifier, reason);
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
      <div className="glass rounded-3xl p-6 w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold tracking-wide flex items-center gap-3">
            <span className="text-3xl">🎲</span> Tirar Dados
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dice Type Selection */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {DICE_TYPES.map((dice) => (
            <button
              key={dice.value}
              onClick={() => setSelectedDice(dice.value)}
              className={`py-4 rounded-xl text-center transition-all ${
                selectedDice === dice.value
                  ? `bg-gradient-to-br ${dice.color} scale-105 shadow-lg`
                  : 'bg-white/5 border border-white/10 hover:border-neon-purple/50 hover:bg-white/10'
              }`}
            >
              <div className="text-2xl mb-1">{dice.icon}</div>
              <div className="text-xs font-display font-bold">{dice.label}</div>
            </button>
          ))}
        </div>

        {/* Count and Modifier */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
              Cantidad
            </label>
            <div className="flex items-center bg-white/5 rounded-xl border border-white/10">
              <button
                onClick={() => setCount(Math.max(1, count - 1))}
                className="w-12 h-12 hover:bg-white/10 rounded-l-xl text-xl font-bold transition-colors"
              >
                -
              </button>
              <div className="flex-1 text-center font-display font-bold text-2xl">
                {count}
              </div>
              <button
                onClick={() => setCount(Math.min(10, count + 1))}
                className="w-12 h-12 hover:bg-white/10 rounded-r-xl text-xl font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
              Modificador
            </label>
            <div className="flex items-center bg-white/5 rounded-xl border border-white/10">
              <button
                onClick={() => setModifier(modifier - 1)}
                className="w-12 h-12 hover:bg-white/10 rounded-l-xl text-xl font-bold transition-colors"
              >
                -
              </button>
              <div className={`flex-1 text-center font-display font-bold text-2xl ${modifier > 0 ? 'text-neon-green' : modifier < 0 ? 'text-red-400' : ''}`}>
                {modifier >= 0 ? '+' : ''}{modifier}
              </div>
              <button
                onClick={() => setModifier(modifier + 1)}
                className="w-12 h-12 hover:bg-white/10 rounded-r-xl text-xl font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-6">
          <label className="block text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
            Razon (opcional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ataque, habilidad, salvacion..."
            className="input-cyber w-full"
          />
        </div>

        {/* Preview */}
        <div className={`text-center mb-6 py-4 rounded-2xl bg-gradient-to-br ${selectedDiceData?.color || 'from-neon-purple to-neon-pink'} bg-opacity-20`}>
          <span className="font-display text-4xl font-black">
            {count}{selectedDice}
            {modifier !== 0 && (
              <span className={modifier > 0 ? 'text-neon-green' : 'text-red-400'}>
                {modifier > 0 ? '+' : ''}{modifier}
              </span>
            )}
          </span>
        </div>

        {/* Result */}
        {result && (
          <div className={`text-center mb-6 py-6 bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 rounded-2xl border border-neon-purple/30 ${rolling ? 'dice-rolling' : ''}`}>
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              {result.results.map((r, i) => (
                <span key={i} className="bg-gradient-to-r from-neon-purple to-neon-pink rounded-xl px-4 py-2 font-display font-bold text-2xl dice-result shadow-lg">
                  {r}
                </span>
              ))}
              {modifier !== 0 && (
                <span className={`text-2xl font-bold ${modifier > 0 ? 'text-neon-green' : 'text-red-400'}`}>
                  {modifier > 0 ? '+' : ''}{modifier}
                </span>
              )}
            </div>
            <div className="text-6xl font-display font-black">{result.total}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!result ? (
            <button
              onClick={handleRoll}
              disabled={rolling}
              className="btn-neon flex-1 py-4 text-lg flex items-center justify-center gap-3"
            >
              {rolling ? (
                <div className="spinner" />
              ) : (
                <>
                  <span className="text-2xl">🎲</span> Tirar
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setResult(null)}
                className="btn-neon-outline flex-1 py-4"
              >
                Repetir
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-4 rounded-full font-display font-bold uppercase tracking-wide bg-gradient-to-r from-neon-green to-emerald-400 text-black hover:shadow-lg hover:shadow-neon-green/30 transition-all"
              >
                Enviar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
