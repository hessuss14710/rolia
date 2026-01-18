import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';

const themeIcons = {
  fantasy: '🏰',
  scifi: '🚀',
  horror: '👻',
  cyberpunk: '🌃',
  pirates: '🏴‍☠️'
};

const themeNames = {
  fantasy: 'Fantasia',
  scifi: 'Ciencia Ficcion',
  horror: 'Terror',
  cyberpunk: 'Cyberpunk',
  pirates: 'Piratas'
};

export default function Lobby() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [roomsData, themesData] = await Promise.all([
        api.getRooms(),
        api.getThemes()
      ]);
      setRooms(roomsData.rooms);
      setThemes(themesData.themes);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom(e) {
    e.preventDefault();
    setError('');

    try {
      await api.joinRoom(joinCode);
      navigate(`/rol/room/${joinCode.toUpperCase()}`);
    } catch (err) {
      setError(err.message);
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'playing': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'ended': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  }

  function getStatusText(status) {
    switch (status) {
      case 'playing': return 'Jugando';
      case 'paused': return 'Pausada';
      case 'ended': return 'Terminada';
      default: return 'Esperando';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-fantasy font-bold text-rolia-400">RolIA</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.username}</span>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white p-2"
            title="Cerrar sesion"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="glass card-hover rounded-xl p-4 text-center"
          >
            <div className="text-3xl mb-2">+</div>
            <div className="font-semibold">Crear sala</div>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="glass card-hover rounded-xl p-4 text-center"
          >
            <div className="text-3xl mb-2">🔑</div>
            <div className="font-semibold">Unirse</div>
          </button>
        </div>

        {/* Rooms List */}
        <h2 className="text-lg font-semibold mb-3 text-gray-300">Mis partidas</h2>

        {rooms.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-gray-400">
            <div className="text-4xl mb-3">🎭</div>
            <p>No tienes partidas activas</p>
            <p className="text-sm mt-1">Crea una sala o unete con un codigo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/rol/room/${room.code}`)}
                className="glass card-hover rounded-xl p-4 w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{themeIcons[room.theme] || '🎲'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{room.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(room.status)}`}>
                        {getStatusText(room.status)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {themeNames[room.theme] || room.theme} • {room.player_count}/{room.max_players} jugadores
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Codigo: <span className="font-mono text-rolia-400">{room.code}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          themes={themes}
          onClose={() => setShowCreateModal(false)}
          onCreated={(room) => {
            setShowCreateModal(false);
            navigate(`/rol/room/${room.code}`);
          }}
        />
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-4">Unirse a sala</h2>
            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-2xl font-mono tracking-widest uppercase"
                placeholder="CODIGO"
                maxLength={6}
                required
                autoFocus
              />
              {error && (
                <div className="mt-3 text-red-400 text-sm text-center">{error}</div>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinCode('');
                    setError('');
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-rolia-600 hover:bg-rolia-500 py-3 rounded-lg font-semibold"
                >
                  Unirse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateRoomModal({ themes, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('fantasy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.createRoom(name, theme);
      onCreated(data.room);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="glass rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-4">Crear nueva sala</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre de la partida</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white"
              placeholder="La aventura comienza..."
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Tematica</label>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.name)}
                  className={`p-3 rounded-lg border transition-colors text-left ${
                    theme === t.name
                      ? 'border-rolia-500 bg-rolia-500/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{themeIcons[t.name] || '🎲'}</span>
                    <span className="text-sm font-medium">{themeNames[t.name] || t.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-rolia-600 hover:bg-rolia-500 disabled:bg-rolia-800 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <span className="spinner"></span> : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
