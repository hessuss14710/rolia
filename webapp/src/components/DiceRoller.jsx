import React, { useState } from 'react';

const DICE_TYPES = [
  { value: 'd4', label: 'D4', icon: '◆' },
  { value: 'd6', label: 'D6', icon: '⬡' },
  { value: 'd8', label: 'D8', icon: '◇' },
  { value: 'd10', label: 'D10', icon: '◈' },
  { value: 'd12', label: 'D12', icon: '⬢' },
  { value: 'd20', label: 'D20', icon: '⬟' },
  { value: 'd100', label: 'D100', icon: '◉' }
];

export default function DiceRoller({ onRoll, onClose }) {
  const [selectedDice, setSelectedDice] = useState('d20');
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [reason, setReason] = useState('');
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);

  function handleRoll() {
    setRolling(true);
    setResult(null);

    // Local roll for immediate feedback
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
    }, 500);
  }

  function handleConfirm() {
    onRoll(`${count}${selectedDice}`, modifier, reason);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="glass rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Tirar dados</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dice Type Selection */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {DICE_TYPES.map((dice) => (
            <button
              key={dice.value}
              onClick={() => setSelectedDice(dice.value)}
              className={`py-3 rounded-lg text-center transition-all ${
                selectedDice === dice.value
                  ? 'bg-rolia-600 scale-105'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <div className="text-2xl mb-1">{dice.icon}</div>
              <div className="text-xs">{dice.label}</div>
            </button>
          ))}
        </div>

        {/* Count and Modifier */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Cantidad</label>
            <div className="flex items-center">
              <button
                onClick={() => setCount(Math.max(1, count - 1))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-l-lg"
              >
                -
              </button>
              <div className="w-12 h-10 bg-white/5 flex items-center justify-center font-mono text-lg">
                {count}
              </div>
              <button
                onClick={() => setCount(Math.min(10, count + 1))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-r-lg"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Modificador</label>
            <div className="flex items-center">
              <button
                onClick={() => setModifier(modifier - 1)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-l-lg"
              >
                -
              </button>
              <div className="w-12 h-10 bg-white/5 flex items-center justify-center font-mono text-lg">
                {modifier >= 0 ? '+' : ''}{modifier}
              </div>
              <button
                onClick={() => setModifier(modifier + 1)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-r-lg"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1">Razon (opcional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ataque, habilidad, salvacion..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Preview */}
        <div className="text-center mb-4 py-3 bg-white/5 rounded-lg">
          <span className="text-2xl font-mono font-bold text-rolia-400">
            {count}{selectedDice}
            {modifier !== 0 && (
              <span className="text-gray-400">
                {modifier > 0 ? '+' : ''}{modifier}
              </span>
            )}
          </span>
        </div>

        {/* Result */}
        {result && (
          <div className={`text-center mb-4 py-4 bg-rolia-600/30 rounded-lg ${rolling ? 'dice-rolling' : ''}`}>
            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
              {result.results.map((r, i) => (
                <span key={i} className="bg-white/20 rounded px-3 py-1 font-mono text-lg">
                  {r}
                </span>
              ))}
              {modifier !== 0 && (
                <span className="text-gray-400 text-lg">
                  {modifier > 0 ? '+' : ''}{modifier}
                </span>
              )}
            </div>
            <div className="text-4xl font-bold">{result.total}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!result ? (
            <button
              onClick={handleRoll}
              disabled={rolling}
              className="flex-1 bg-rolia-600 hover:bg-rolia-500 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              {rolling ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <span>🎲</span> Tirar
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setResult(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-lg"
              >
                Repetir
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-lg font-semibold"
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
