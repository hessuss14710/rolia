import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';
import socketService from '../services/socket';

const themeIcons = {
  fantasy: '🏰',
  scifi: '🚀',
  horror: '👻',
  cyberpunk: '🌃',
  pirates: '🏴‍☠️'
};

const themeNames = {
  fantasy: 'Fantasia Medieval',
  scifi: 'Ciencia Ficcion',
  horror: 'Terror',
  cyberpunk: 'Cyberpunk',
  pirates: 'Piratas'
};

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadRoom();
    return () => {
      socketService.leaveRoom();
    };
  }, [code]);

  useEffect(() => {
    if (room) {
      socketService.connect();
      socketService.joinRoom(code);

      socketService.on('user-joined', handleUserJoined);
      socketService.on('user-left', handleUserLeft);
      socketService.on('room-status-changed', handleStatusChanged);
      socketService.on('character-created', handleCharacterCreated);
      socketService.on('room-deleted', handleRoomDeleted);

      return () => {
        socketService.off('user-joined', handleUserJoined);
        socketService.off('user-left', handleUserLeft);
        socketService.off('room-status-changed', handleStatusChanged);
        socketService.off('character-created', handleCharacterCreated);
        socketService.off('room-deleted', handleRoomDeleted);
      };
    }
  }, [room]);

  async function loadRoom() {
    try {
      const [roomData, charData] = await Promise.all([
        api.getRoom(code),
        api.getRoomCharacter(code)
      ]);
      setRoom(roomData.room);
      setCharacter(charData.character);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUserJoined(data) {
    setRoom(prev => ({
      ...prev,
      participants: [...(prev?.participants || []), { id: data.userId, username: data.username, joined_at: new Date() }]
    }));
  }

  function handleUserLeft(data) {
    setRoom(prev => ({
      ...prev,
      participants: prev?.participants?.filter(p => p.id !== data.userId) || []
    }));
  }

  function handleStatusChanged(data) {
    setRoom(prev => ({ ...prev, status: data.status }));
    if (data.status === 'playing') {
      navigate(`/rol/room/${code}/game`);
    }
  }

  function handleCharacterCreated(data) {
    loadRoom();
  }

  function handleRoomDeleted() {
    navigate('/rol');
  }

  async function handleStartGame() {
    try {
      await api.updateRoomStatus(code, 'playing');
      navigate(`/rol/room/${code}/game`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLeaveRoom() {
    try {
      await api.leaveRoom(code);
      navigate('/rol');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteRoom() {
    if (!confirm('¿Eliminar esta sala? Se perdera todo el progreso.')) return;
    try {
      await api.deleteRoom(code);
      navigate('/rol');
    } catch (err) {
      setError(err.message);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (error && !room) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
        <div className="bg-animation" />
        <div className="stars" />
        <div className="grid-overlay" />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-6">😵</div>
          <div className="text-red-400 text-xl mb-6">{error}</div>
          <button
            onClick={() => navigate('/rol')}
            className="btn-neon px-8 py-3"
          >
            Volver al lobby
          </button>
        </div>
      </div>
    );
  }

  const isOwner = room?.owner_id === user?.id;
  const participantCount = room?.participants?.length || 0;
  const hasCharacter = !!character;

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
            onClick={() => navigate('/rol')}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-lg truncate">{room?.name}</h1>
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <span>{themeIcons[room?.theme]}</span>
              <span>{themeNames[room?.theme] || room?.theme}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 max-w-lg mx-auto">
        {/* Room Code Card */}
        <div className="glass rounded-2xl p-6 mb-6 text-center animate-scale-in">
          <div className="text-sm text-gray-400 mb-2 font-medium tracking-wide uppercase">
            Codigo de sala
          </div>
          <button
            onClick={copyCode}
            className="flex items-center justify-center gap-3 mx-auto group"
          >
            <span className="room-code text-4xl">{code}</span>
            <svg className="w-6 h-6 text-gray-500 group-hover:text-neon-purple transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {copied && (
            <div className="text-neon-green text-sm mt-3 animate-fade-in flex items-center justify-center gap-1">
              <span>✓</span> Codigo copiado
            </div>
          )}
          <div className="text-xs text-gray-600 mt-3">
            Comparte este codigo con tus amigos para que se unan
          </div>
        </div>

        {/* Character Status */}
        <div className="card-cyber rounded-2xl p-5 mb-6">
          <h3 className="font-display font-bold text-lg mb-4 tracking-wide flex items-center gap-2">
            <span>🎭</span> Tu Personaje
          </h3>
          {hasCharacter ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 border border-neon-purple/50 flex items-center justify-center text-3xl">
                🧙
              </div>
              <div className="flex-1">
                <div className="font-display font-bold text-xl">{character.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  {character.class} • Nivel {character.level}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="stat-bar flex-1">
                    <div
                      className={`stat-bar-fill ${character.hp / character.max_hp > 0.5 ? 'hp-full' : character.hp / character.max_hp > 0.25 ? 'hp-medium' : 'hp-low'}`}
                      style={{ width: `${(character.hp / character.max_hp) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono">{character.hp}/{character.max_hp}</span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/rol/room/${code}/character`)}
                className="text-neon-purple hover:text-neon-pink transition-colors p-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate(`/rol/room/${code}/character`)}
              className="btn-neon w-full py-4 text-lg"
            >
              <span className="flex items-center justify-center gap-2">
                <span>✨</span> Crear personaje
              </span>
            </button>
          )}
        </div>

        {/* Participants */}
        <div className="card-cyber rounded-2xl p-5 mb-6">
          <h3 className="font-display font-bold text-lg mb-4 tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>👥</span> Jugadores
            </span>
            <span className="text-sm font-normal text-gray-400">
              {participantCount}/{room?.max_players}
            </span>
          </h3>
          <div className="space-y-3">
            {room?.participants?.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30 flex items-center justify-center font-display font-bold">
                  {p.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{p.username}</span>
                  {p.id === room.owner_id && (
                    <span className="ml-2 text-xs text-neon-purple badge-cyber py-0.5 px-2">
                      Host
                    </span>
                  )}
                </div>
                {p.id === user?.id && (
                  <span className="text-xs text-gray-500">Tu</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {isOwner && hasCharacter && participantCount >= 1 && (
            <button
              onClick={handleStartGame}
              className="w-full py-5 rounded-2xl font-display font-bold text-xl uppercase tracking-wider bg-gradient-to-r from-neon-green to-emerald-400 text-black flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-neon-green/30 transition-all hover:scale-[1.02]"
            >
              <span>🎮</span> Iniciar partida
            </button>
          )}

          {room?.status === 'playing' && (
            <button
              onClick={() => navigate(`/rol/room/${code}/game`)}
              className="w-full py-5 rounded-2xl font-display font-bold text-xl uppercase tracking-wider bg-gradient-to-r from-neon-green to-emerald-400 text-black flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-neon-green/30 transition-all hover:scale-[1.02]"
            >
              <span>⚔️</span> Entrar a la partida
            </button>
          )}

          {!isOwner && (
            <button
              onClick={handleLeaveRoom}
              className="w-full py-4 rounded-2xl border-2 border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all font-medium"
            >
              Abandonar sala
            </button>
          )}

          {isOwner && (
            <button
              onClick={handleDeleteRoom}
              className="w-full py-4 rounded-2xl border-2 border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all font-medium"
            >
              Eliminar sala
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
