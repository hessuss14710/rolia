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

export default function CharacterCreate() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [theme, setTheme] = useState(null);
  const [existingCharacter, setExistingCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    // Roll 3d6 for each stat (classic D&D style)
    const newStats = {};
    for (const key of Object.keys(stats)) {
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ];
      newStats[key] = rolls.reduce((a, b) => a + b, 0);
    }
    setStats(newStats);
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
        <div className="spinner"></div>
      </div>
    );
  }

  const classes = theme?.example_classes || ['Aventurero'];

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/rol/room/${code}`)}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold flex-1">
            {existingCharacter ? 'Editar personaje' : 'Crear personaje'}
          </h1>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Name */}
          <div className="glass rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-lg"
              placeholder="Nombre de tu personaje"
              required
              autoFocus
            />
          </div>

          {/* Class */}
          <div className="glass rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Clase</label>
            <div className="grid grid-cols-2 gap-2">
              {classes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCharacterClass(c)}
                  className={`py-2 px-3 rounded-lg border text-sm transition-colors ${
                    characterClass === c
                      ? 'border-rolia-500 bg-rolia-500/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-400">Estadisticas</label>
              <button
                type="button"
                onClick={rollStats}
                className="text-sm text-rolia-400 hover:text-rolia-300 flex items-center gap-1"
              >
                🎲 Tirar dados
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-24 truncate">
                    {statNames[key] || key}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateStat(key, -1)}
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono text-lg">{value}</span>
                  <button
                    type="button"
                    onClick={() => updateStat(key, 1)}
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center"
                  >
                    +
                  </button>
                  <div className="flex-1 bg-white/10 rounded-full h-2">
                    <div
                      className="bg-rolia-500 rounded-full h-full transition-all"
                      style={{ width: `${(value / 20) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="glass rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Historia (opcional)</label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white resize-none"
              placeholder="Describe el trasfondo de tu personaje..."
              rows={4}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-rolia-600 hover:bg-rolia-500 disabled:bg-rolia-800 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="spinner"></span>
            ) : existingCharacter ? (
              'Guardar cambios'
            ) : (
              'Crear personaje'
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
