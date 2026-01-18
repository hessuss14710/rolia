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

const themeColors = {
  fantasy: 'from-blue-600/20 to-purple-600/20 border-blue-500/30',
  scifi: 'from-cyan-600/20 to-blue-600/20 border-cyan-500/30',
  horror: 'from-red-900/20 to-gray-900/20 border-red-500/30',
  cyberpunk: 'from-pink-600/20 to-purple-600/20 border-pink-500/30',
  pirates: 'from-amber-600/20 to-orange-600/20 border-amber-500/30'
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
      case 'playing': return 'bg-neon-green';
      case 'paused': return 'bg-yellow-500';
      case 'ended': return 'bg-gray-500';
      default: return 'bg-neon-blue';
    }
  }

  function getStatusText(status) {
    switch (status) {
      case 'playing': return 'En juego';
      case 'paused': return 'Pausada';
      case 'ended': return 'Terminada';
      default: return 'Esperando';
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

  return (
    <div className="min-h-screen relative pb-24">
      {/* Animated backgrounds */}
      <div className="bg-animation" />
      <div className="stars" />
      <div className="grid-overlay" />

      {/* Header */}
      <header className="glass-strong sticky top-0 z-20 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="logo-text text-2xl">ROLIA</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-sm font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-400 hidden sm:block">{user?.username}</span>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-neon-pink p-2 transition-colors"
              title="Cerrar sesion"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 max-w-lg mx-auto">
        {/* Welcome message */}
        <div className="text-center mb-6 animate-fade-in">
          <h2 className="font-display text-xl font-bold text-gray-200 tracking-wide">
            Bienvenido, <span className="text-neon-purple">{user?.username}</span>
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="card-cyber p-5 text-center group"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">✨</div>
            <div className="font-display font-bold text-lg tracking-wide">Crear sala</div>
            <div className="text-xs text-gray-500 mt-1">Nueva aventura</div>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="card-cyber p-5 text-center group"
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🔑</div>
            <div className="font-display font-bold text-lg tracking-wide">Unirse</div>
            <div className="text-xs text-gray-500 mt-1">Con codigo</div>
          </button>
        </div>

        {/* Rooms List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-gray-300 tracking-wide uppercase">
            Mis partidas
          </h2>
          <span className="text-xs text-gray-500">{rooms.length} activas</span>
        </div>

        {rooms.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center animate-fade-in">
            <div className="text-6xl mb-4 opacity-50">🎭</div>
            <p className="text-gray-400 text-lg mb-2">No tienes partidas activas</p>
            <p className="text-gray-600 text-sm">Crea una sala o unete con un codigo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room, index) => (
              <button
                key={room.id}
                onClick={() => navigate(`/rol/room/${room.code}`)}
                className={`w-full text-left rounded-2xl p-5 border transition-all hover:scale-[1.02] hover:shadow-lg bg-gradient-to-br ${themeColors[room.theme] || 'from-gray-800/20 to-gray-900/20 border-gray-500/30'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{themeIcons[room.theme] || '🎲'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display font-bold text-lg truncate">{room.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                        {getStatusText(room.status)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <span>{themeNames[room.theme] || room.theme}</span>
                      <span className="text-gray-600">•</span>
                      <span>{room.player_count}/{room.max_players} jugadores</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Codigo:</span>
                      <span className="room-code text-sm">{room.code}</span>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="glass rounded-3xl p-8 w-full max-w-sm animate-scale-in">
            <h2 className="font-display text-2xl font-bold text-center mb-6 tracking-wide">
              Unirse a sala
            </h2>
            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-dark-darker border-2 border-neon-purple/50 rounded-xl px-6 py-4 text-white text-center text-3xl font-display font-bold tracking-[0.5em] uppercase focus:border-neon-purple focus:outline-none focus:shadow-lg focus:shadow-neon-purple/20 transition-all"
                placeholder="CODIGO"
                maxLength={6}
                required
                autoFocus
              />
              {error && (
                <div className="mt-4 text-red-400 text-sm text-center flex items-center justify-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinCode('');
                    setError('');
                  }}
                  className="btn-neon-outline flex-1 py-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-neon flex-1 py-4"
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
    <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
      <div className="glass rounded-3xl p-8 w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-6 tracking-wide">
          Nueva Aventura
        </h2>
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-medium tracking-wide uppercase">
              Nombre de la partida
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-cyber w-full"
              placeholder="La aventura comienza..."
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-3 font-medium tracking-wide uppercase">
              Elige tu mundo
            </label>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.name)}
                  className={`theme-card p-4 text-left ${
                    theme === t.name
                      ? 'ring-2 ring-neon-purple shadow-lg shadow-neon-purple/20'
                      : ''
                  } ${themeColors[t.name]?.split(' ')[0] || ''} bg-gradient-to-br ${themeColors[t.name] || 'from-gray-800/20 to-gray-900/20 border-gray-500/30'}`}
                >
                  <div className="relative z-10">
                    <div className="text-3xl mb-2">{themeIcons[t.name] || '🎲'}</div>
                    <div className="font-display font-bold text-sm">{themeNames[t.name] || t.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center flex items-center justify-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-neon-outline flex-1 py-4"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-neon flex-1 py-4 flex items-center justify-center gap-2"
            >
              {loading ? <div className="spinner" /> : (
                <>
                  <span>✨</span> Crear
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
