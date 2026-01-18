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
      // Connect to socket and join room
      socketService.connect();
      socketService.joinRoom(code);

      // Listen for updates
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
    loadRoom(); // Reload to get updated character list
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
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-red-400 mb-4">{error}</div>
        <button
          onClick={() => navigate('/rol')}
          className="bg-rolia-600 hover:bg-rolia-500 px-6 py-2 rounded-lg"
        >
          Volver al lobby
        </button>
      </div>
    );
  }

  const isOwner = room?.owner_id === user?.id;
  const participantCount = room?.participants?.length || 0;
  const hasCharacter = !!character;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/rol')}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="font-semibold truncate">{room?.name}</h1>
            <div className="text-xs text-gray-400">{room?.theme}</div>
          </div>
          <span className="text-2xl">{themeIcons[room?.theme] || '🎲'}</span>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Room Code */}
        <div className="glass rounded-xl p-4 mb-4 text-center">
          <div className="text-sm text-gray-400 mb-1">Codigo de sala</div>
          <button
            onClick={copyCode}
            className="flex items-center justify-center gap-2 mx-auto"
          >
            <span className="text-3xl font-mono font-bold text-rolia-400 tracking-widest">{code}</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {copied && <div className="text-green-400 text-sm mt-1">Copiado!</div>}
          <div className="text-xs text-gray-500 mt-2">Comparte este codigo con tus amigos</div>
        </div>

        {/* Character Status */}
        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-3">Tu personaje</h3>
          {hasCharacter ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rolia-600/30 flex items-center justify-center text-2xl">
                🧙
              </div>
              <div className="flex-1">
                <div className="font-semibold">{character.name}</div>
                <div className="text-sm text-gray-400">
                  {character.class} • Nivel {character.level}
                </div>
              </div>
              <button
                onClick={() => navigate(`/rol/room/${code}/character`)}
                className="text-rolia-400 hover:text-rolia-300 text-sm"
              >
                Editar
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate(`/rol/room/${code}/character`)}
              className="w-full bg-rolia-600 hover:bg-rolia-500 py-3 rounded-lg font-semibold"
            >
              Crear personaje
            </button>
          )}
        </div>

        {/* Participants */}
        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-3">
            Jugadores ({participantCount}/{room?.max_players})
          </h3>
          <div className="space-y-2">
            {room?.participants?.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                  {p.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{p.username}</span>
                  {p.id === room.owner_id && (
                    <span className="ml-2 text-xs text-rolia-400">Propietario</span>
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
        <div className="space-y-3">
          {isOwner && hasCharacter && participantCount >= 1 && (
            <button
              onClick={handleStartGame}
              className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
            >
              <span>🎮</span> Iniciar partida
            </button>
          )}

          {room?.status === 'playing' && (
            <button
              onClick={() => navigate(`/rol/room/${code}/game`)}
              className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
            >
              <span>🎮</span> Entrar a la partida
            </button>
          )}

          {!isOwner && (
            <button
              onClick={handleLeaveRoom}
              className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-xl"
            >
              Abandonar sala
            </button>
          )}

          {isOwner && (
            <button
              onClick={handleDeleteRoom}
              className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-xl"
            >
              Eliminar sala
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
