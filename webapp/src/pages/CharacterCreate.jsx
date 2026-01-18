import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

const statNames = {
  str: 'Fuerza',
  dex: 'Destreza',
  con: 'Constitucion',
  int: 'Inteligencia',
  wis: 'Sabiduria',
  cha: 'Carisma',
  tech: 'Tecnologia',
  combat: 'Combate',
  pilot: 'Pilotaje',
  science: 'Ciencia',
  social: 'Social',
  survival: 'Supervivencia',
  fuerza: 'Fuerza',
  agilidad: 'Agilidad',
  resistencia: 'Resistencia',
  percepcion: 'Percepcion',
  voluntad: 'Voluntad',
  cordura: 'Cordura',
  cuerpo: 'Cuerpo',
  reflejos: 'Reflejos',
  tecnica: 'Tecnica',
  inteligencia: 'Inteligencia',
  carisma: 'Carisma',
  suerte: 'Suerte',
  navegacion: 'Navegacion',
  punteria: 'Punteria'
};

const statIcons = {
  str: '💪', dex: '🏃', con: '🛡️', int: '🧠', wis: '👁️', cha: '💬',
  tech: '🔧', combat: '⚔️', pilot: '🚀', science: '🔬', social: '🤝', survival: '🏕️',
  fuerza: '💪', agilidad: '🏃', resistencia: '🛡️', percepcion: '👁️', voluntad: '🧠', cordura: '😰',
  cuerpo: '💪', reflejos: '⚡', tecnica: '🔧', inteligencia: '🧠', carisma: '💬', suerte: '🍀',
  navegacion: '🧭', punteria: '🎯'
};

export default function CharacterCreate() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [theme, setTheme] = useState(null);
  const [existingCharacter, setExistingCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rolling, setRolling] = useState(false);

  const [name, setName] = useState('');
  const [characterClass, setCharacterClass] = useState('');
  const [stats, setStats] = useState({});
  const [background, setBackground] = useState('');

  useEffect(() => {
    loadData();
  }, [code]);

  async function loadData() {
    try {
      const [roomData, charData, themesData] = await Promise.all([
        api.getRoom(code),
        api.getRoomCharacter(code),
        api.getThemes()
      ]);

      setRoom(roomData.room);

      const currentTheme = themesData.themes.find(t => t.name === roomData.room.theme);
      setTheme(currentTheme);

      if (charData.character) {
        setExistingCharacter(charData.character);
        setName(charData.character.name);
        setCharacterClass(charData.character.class);
        setStats(charData.character.stats || {});
        setBackground(charData.character.background || '');
      } else if (currentTheme?.default_stats) {
        setStats(currentTheme.default_stats);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function rollStats() {
    setRolling(true);
    const newStats = {};
    for (const key of Object.keys(stats)) {
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ];
      newStats[key] = rolls.reduce((a, b) => a + b, 0);
    }
    setTimeout(() => {
      setStats(newStats);
      setRolling(false);
    }, 500);
  }

  function updateStat(key, delta) {
    setStats(prev => ({
      ...prev,
      [key]: Math.max(1, Math.min(20, (prev[key] || 10) + delta))
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (existingCharacter) {
        await api.updateCharacter(existingCharacter.id, {
          name,
          characterClass,
          stats,
          background
        });
      } else {
        await api.createCharacter(code, name, characterClass, stats, background);
      }
      navigate(`/rol/room/${code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-animation" />
        <div className="stars" />
        <div className="grid-overlay" />
        <div className="spinner-large" />
      </div>
    );
  }

  const classes = theme?.example_classes || ['Aventurero'];

  return (
    <div className="min-h-screen relative pb-24">
      {/* Animated backgrounds */}
      <div className="bg-animation" />
      <div className="stars" />
      <div className="grid-overlay" />

      {/* Header */}
      <header className="glass-strong sticky top-0 z-20 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate(`/rol/room/${code}`)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-display font-bold text-xl tracking-wide">
            {existingCharacter ? 'Editar Personaje' : 'Crear Personaje'}
          </h1>
        </div>
      </header>

      <main className="relative z-10 p-4 max-w-lg mx-auto">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Name */}
          <div className="card-cyber rounded-2xl p-5 animate-fade-in">
            <label className="block text-sm text-gray-400 mb-3 font-medium tracking-wide uppercase flex items-center gap-2">
              <span>✨</span> Nombre del Personaje
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-cyber w-full text-xl font-display"
              placeholder="Nombre legendario..."
              required
              autoFocus
            />
          </div>

          {/* Class */}
          <div className="card-cyber rounded-2xl p-5">
            <label className="block text-sm text-gray-400 mb-3 font-medium tracking-wide uppercase flex items-center gap-2">
              <span>⚔️</span> Clase
            </label>
            <div className="grid grid-cols-2 gap-3">
              {classes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCharacterClass(c)}
                  className={`py-3 px-4 rounded-xl text-sm font-display font-bold transition-all ${
                    characterClass === c
                      ? 'bg-gradient-to-r from-neon-purple to-neon-pink text-white shadow-lg shadow-neon-purple/30'
                      : 'bg-white/5 border border-white/10 hover:border-neon-purple/50 hover:bg-white/10'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="card-cyber rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm text-gray-400 font-medium tracking-wide uppercase flex items-center gap-2">
                <span>📊</span> Estadisticas
              </label>
              <button
                type="button"
                onClick={rollStats}
                disabled={rolling}
                className="btn-neon-outline px-4 py-2 text-sm flex items-center gap-2"
              >
                <span className={rolling ? 'dice-rolling' : ''}>🎲</span>
                Tirar dados
              </button>
            </div>
            <div className="space-y-4">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xl w-8">{statIcons[key] || '📌'}</span>
                  <span className="text-sm text-gray-400 w-24 truncate font-medium">
                    {statNames[key] || key}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateStat(key, -1)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-lg font-bold transition-colors"
                  >
                    -
                  </button>
                  <span className={`w-12 text-center font-display font-bold text-2xl ${value >= 15 ? 'text-neon-green' : value <= 8 ? 'text-red-400' : 'text-white'}`}>
                    {value}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateStat(key, 1)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-neon-green/30 flex items-center justify-center text-lg font-bold transition-colors"
                  >
                    +
                  </button>
                  <div className="flex-1 stat-bar">
                    <div
                      className={`stat-bar-fill ${value >= 15 ? 'hp-full' : value >= 10 ? 'bg-gradient-to-r from-neon-blue to-neon-cyan' : 'hp-low'}`}
                      style={{ width: `${(value / 20) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="card-cyber rounded-2xl p-5">
            <label className="block text-sm text-gray-400 mb-3 font-medium tracking-wide uppercase flex items-center gap-2">
              <span>📜</span> Historia (opcional)
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="input-cyber w-full resize-none"
              placeholder="Describe el trasfondo de tu personaje, su historia, motivaciones..."
              rows={4}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="btn-neon w-full py-5 text-xl flex items-center justify-center gap-3"
          >
            {saving ? (
              <div className="spinner" />
            ) : (
              <>
                <span>✨</span>
                {existingCharacter ? 'Guardar cambios' : 'Crear personaje'}
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
