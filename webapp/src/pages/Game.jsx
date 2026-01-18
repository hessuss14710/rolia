import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';
import socketService from '../services/socket';
import PTTButton from '../components/PTTButton';
import DiceRoller from '../components/DiceRoller';
import CharacterSheet from '../components/CharacterSheet';

export default function Game() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [speakingUsers, setSpeakingUsers] = useState(new Set());

  useEffect(() => {
    loadGame();
    return () => {
      socketService.leaveRoom();
      socketService.removeAllListeners();
    };
  }, [code]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadGame() {
    try {
      const [roomData, charData, historyData] = await Promise.all([
        api.getRoom(code),
        api.getRoomCharacter(code),
        api.getGameHistory(code)
      ]);

      setRoom(roomData.room);
      setCharacter(charData.character);

      // Convert history to messages
      const msgs = historyData.history.map(h => ({
        id: h.id,
        type: h.speaker === 'ia' ? 'ai' : 'user',
        speaker: h.speaker,
        speakerName: h.speaker === 'ia' ? 'Narrador' : h.speaker_name,
        text: h.message,
        diceRoll: h.dice_roll,
        timestamp: h.timestamp
      }));
      setMessages(msgs);

      // Setup socket
      socketService.connect();
      socketService.joinRoom(code);

      socketService.on('room-users', (users) => setRoomUsers(users));
      socketService.on('user-joined', handleUserJoined);
      socketService.on('user-left', handleUserLeft);
      socketService.on('chat-message', handleChatMessage);
      socketService.on('ai-message', handleAIMessage);
      socketService.on('dice-result', handleDiceResult);
      socketService.on('user-speaking', handleUserSpeaking);
      socketService.on('room-status-changed', handleStatusChanged);
      socketService.on('character-updated', handleCharacterUpdated);

    } catch (err) {
      console.error('Error loading game:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleUserJoined(data) {
    setRoomUsers(prev => [...prev.filter(u => u.odId !== data.userId), {
      odId: data.userId,
      username: data.username
    }]);
    addSystemMessage(`${data.username} se ha unido`);
  }

  function handleUserLeft(data) {
    setRoomUsers(prev => prev.filter(u => u.odId !== data.userId));
    addSystemMessage(`${data.username} se ha ido`);
  }

  function handleChatMessage(data) {
    if (data.userId === user.id) return; // Skip own messages
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      speaker: `user:${data.userId}`,
      speakerName: data.username,
      text: data.message,
      timestamp: data.timestamp
    }]);
  }

  function handleAIMessage(data) {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'ai',
      speaker: 'ia',
      speakerName: 'Narrador',
      text: data.text,
      diceRoll: data.diceRoll,
      timestamp: data.timestamp
    }]);

    // Handle character updates from AI
    if (data.characterUpdate && character) {
      if (data.characterUpdate.hpChange) {
        const newHp = Math.max(0, Math.min(character.max_hp, character.hp + data.characterUpdate.hpChange));
        setCharacter(prev => ({ ...prev, hp: newHp }));
        api.updateCharacter(character.id, { hp: newHp });
      }
    }
  }

  function handleDiceResult(data) {
    if (data.userId === user.id) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'dice',
      speaker: `user:${data.userId}`,
      speakerName: data.username,
      diceRoll: {
        dice: data.dice,
        results: data.results,
        modifier: data.modifier,
        total: data.total
      },
      text: data.reason || `Tirada de ${data.dice}`,
      timestamp: data.timestamp
    }]);
  }

  function handleUserSpeaking(data) {
    setSpeakingUsers(prev => {
      const next = new Set(prev);
      if (data.speaking) {
        next.add(data.odId);
      } else {
        next.delete(data.odId);
      }
      return next;
    });
  }

  function handleStatusChanged(data) {
    if (data.status === 'paused' || data.status === 'ended') {
      navigate(`/rol/room/${code}`);
    }
  }

  function handleCharacterUpdated(data) {
    if (data.characterId === character?.id) {
      loadGame(); // Reload character
    }
  }

  function addSystemMessage(text) {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'system',
      text,
      timestamp: new Date().toISOString()
    }]);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleVoiceResult(data) {
    // Add user's transcribed message
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      speaker: `user:${user.id}`,
      speakerName: user.username,
      text: data.transcription,
      timestamp: new Date().toISOString()
    }]);

    // Add AI response
    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      type: 'ai',
      speaker: 'ia',
      speakerName: 'Narrador',
      text: data.aiResponse,
      diceRoll: data.diceRoll,
      timestamp: new Date().toISOString()
    }]);

    // Play audio response
    if (data.audioBase64) {
      playAudio(data.audioBase64);
    }

    // Handle character updates
    if (data.characterUpdate && character) {
      if (data.characterUpdate.hpChange) {
        const newHp = Math.max(0, Math.min(character.max_hp, character.hp + data.characterUpdate.hpChange));
        setCharacter(prev => ({ ...prev, hp: newHp }));
        api.updateCharacter(character.id, { hp: newHp });
      }
    }
  }

  async function handleTextSubmit(e) {
    e.preventDefault();
    if (!textInput.trim() || processing) return;

    const message = textInput.trim();
    setTextInput('');
    setProcessing(true);

    // Add message immediately
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      speaker: `user:${user.id}`,
      speakerName: user.username,
      text: message,
      timestamp: new Date().toISOString()
    }]);

    try {
      const response = await api.sendMessage(code, message);

      // Add AI response
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'ai',
        speaker: 'ia',
        speakerName: 'Narrador',
        text: response.aiResponse,
        diceRoll: response.diceRoll,
        timestamp: new Date().toISOString()
      }]);

      if (response.audioBase64) {
        playAudio(response.audioBase64);
      }
    } catch (err) {
      addSystemMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  function playAudio(base64) {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audioRef.current = audio;
      audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  }

  function handleDiceRoll(dice, modifier, reason) {
    api.rollDice(code, dice, modifier, reason).then(result => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'dice',
        speaker: `user:${user.id}`,
        speakerName: user.username,
        diceRoll: result,
        text: reason || `Tirada de ${dice}`,
        timestamp: new Date().toISOString()
      }]);
    });
    setShowDice(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
      {/* Header */}
      <header className="glass px-4 py-2 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate(`/rol/room/${code}`)}
          className="p-2 hover:bg-white/10 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate text-sm">{room?.name}</h1>
        </div>

        {/* Online users */}
        <div className="flex -space-x-2">
          {roomUsers.slice(0, 4).map((u) => (
            <div
              key={u.odId}
              className={`w-8 h-8 rounded-full bg-rolia-600 flex items-center justify-center text-xs font-bold border-2 border-gray-900 ${
                speakingUsers.has(u.odId) ? 'ring-2 ring-green-400 speaking-indicator' : ''
              }`}
              title={u.username}
            >
              {u.username?.charAt(0).toUpperCase()}
            </div>
          ))}
          {roomUsers.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs border-2 border-gray-900">
              +{roomUsers.length - 4}
            </div>
          )}
        </div>

        {/* Character button */}
        {character && (
          <button
            onClick={() => setShowCharacter(true)}
            className="p-2 hover:bg-white/10 rounded-lg relative"
          >
            <span className="text-lg">🧙</span>
            <div className="absolute -bottom-1 -right-1 text-xs bg-red-600 rounded-full px-1">
              {character.hp}
            </div>
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.speaker === `user:${user.id}`} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="glass p-4 shrink-0">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {/* Dice button */}
          <button
            onClick={() => setShowDice(true)}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl shrink-0"
          >
            🎲
          </button>

          {/* Text input */}
          <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Escribe tu accion..."
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white placeholder-gray-500"
              disabled={processing}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || processing}
              className="w-10 h-10 rounded-full bg-rolia-600 hover:bg-rolia-500 disabled:bg-gray-700 flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>

          {/* PTT Button */}
          <PTTButton
            roomCode={code}
            onResult={handleVoiceResult}
            onProcessing={setProcessing}
            disabled={processing}
          />
        </div>
      </div>

      {/* Dice Modal */}
      {showDice && (
        <DiceRoller
          onRoll={handleDiceRoll}
          onClose={() => setShowDice(false)}
        />
      )}

      {/* Character Sheet Modal */}
      {showCharacter && character && (
        <CharacterSheet
          character={character}
          onClose={() => setShowCharacter(false)}
          onUpdate={(updates) => {
            setCharacter(prev => ({ ...prev, ...updates }));
            api.updateCharacter(character.id, updates);
          }}
        />
      )}
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  if (message.type === 'system') {
    return (
      <div className="text-center text-gray-500 text-sm py-1">
        {message.text}
      </div>
    );
  }

  if (message.type === 'dice') {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="glass rounded-xl p-3 max-w-xs">
          <div className="text-xs text-gray-400 mb-1">{message.speakerName}</div>
          <div className="text-sm text-gray-300 mb-2">{message.text}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">🎲</span>
            {message.diceRoll?.results?.map((r, i) => (
              <span key={i} className="bg-rolia-600 rounded px-2 py-1 font-mono font-bold">
                {r}
              </span>
            ))}
            {message.diceRoll?.modifier !== 0 && (
              <span className="text-gray-400">
                {message.diceRoll.modifier > 0 ? '+' : ''}{message.diceRoll.modifier}
              </span>
            )}
            <span className="text-xl font-bold text-rolia-400">=</span>
            <span className="text-2xl font-bold">{message.diceRoll?.total}</span>
          </div>
        </div>
      </div>
    );
  }

  const isAI = message.type === 'ai';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-enter`}>
      <div
        className={`rounded-2xl p-3 max-w-[85%] ${
          isAI
            ? 'bg-gradient-to-br from-rolia-900/80 to-rolia-800/60 border border-rolia-500/30'
            : isOwn
            ? 'bg-rolia-600'
            : 'glass'
        }`}
      >
        {!isOwn && !isAI && (
          <div className="text-xs text-gray-400 mb-1">{message.speakerName}</div>
        )}
        {isAI && (
          <div className="text-xs text-rolia-400 mb-1 flex items-center gap-1">
            <span>🎭</span> Narrador
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap">{message.text}</div>
        {message.diceRoll?.suggested && (
          <div className="mt-2 bg-black/30 rounded-lg p-2 text-xs">
            <span className="text-gray-400">Tirada sugerida:</span>{' '}
            <span className="text-rolia-400 font-mono">{message.diceRoll.suggested}</span>
            {message.diceRoll.modifier !== 0 && (
              <span className="text-gray-400">
                {message.diceRoll.modifier > 0 ? '+' : ''}{message.diceRoll.modifier}
              </span>
            )}
            <span className="text-gray-400"> vs DC {message.diceRoll.dc}</span>
          </div>
        )}
      </div>
    </div>
  );
}
