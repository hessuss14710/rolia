import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';
import socketService from '../services/socket';
import PTTButton from '../components/PTTButton';
import DiceRoller from '../components/DiceRoller';
import CharacterSheet from '../components/CharacterSheet';
import ShopModal from '../components/ShopModal';
import { formatPrice } from '../utils/itemUtils';

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
  const [showShop, setShowShop] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [gold, setGold] = useState(100);

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
      if (charData.character) {
        setGold(charData.character.gold || 100);
      }

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
    if (data.userId === user.id) return;
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

    if (data.characterUpdate) {
      processCharacterUpdate(data.characterUpdate);
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
      loadGame();
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

  function addNotification(type, message, icon) {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message, icon }]);
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }

  async function processCharacterUpdate(characterUpdate) {
    if (!characterUpdate || !character) return;

    // Process HP changes
    if (characterUpdate.hpChange) {
      const newHp = Math.max(0, Math.min(character.max_hp, character.hp + characterUpdate.hpChange));
      setCharacter(prev => ({ ...prev, hp: newHp }));
      api.updateCharacter(character.id, { hp: newHp });

      if (characterUpdate.hpChange > 0) {
        addNotification('heal', `+${characterUpdate.hpChange} HP`, '❤️');
      } else {
        addNotification('damage', `${characterUpdate.hpChange} HP`, '💔');
      }
    }

    // Process gold changes
    if (characterUpdate.goldChange) {
      try {
        await api.modifyCharacterGold(character.id, characterUpdate.goldChange, 'ai_reward');
        setGold(prev => prev + characterUpdate.goldChange);

        if (characterUpdate.goldChange > 0) {
          addNotification('gold', `+${characterUpdate.goldChange} oro`, '🪙');
        } else {
          addNotification('gold', `${characterUpdate.goldChange} oro`, '🪙');
        }
      } catch (err) {
        console.error('Error updating gold:', err);
      }
    }

    // Process item changes
    if (characterUpdate.itemChanges && characterUpdate.itemChanges.length > 0) {
      for (const itemChange of characterUpdate.itemChanges) {
        try {
          if (itemChange.action === 'add') {
            await api.addItemToInventory(character.id, itemChange.code, 1, 'ai_reward');
            addNotification('item', `Obtenido: ${itemChange.code}`, '📦');
          } else if (itemChange.action === 'remove') {
            await api.removeItemFromInventory(character.id, itemChange.code, 1);
            addNotification('item', `Perdido: ${itemChange.code}`, '📦');
          }
        } catch (err) {
          console.error('Error updating inventory:', err);
        }
      }
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleVoiceResult(data) {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      speaker: `user:${user.id}`,
      speakerName: user.username,
      text: data.transcription,
      timestamp: new Date().toISOString()
    }]);

    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      type: 'ai',
      speaker: 'ia',
      speakerName: 'Narrador',
      text: data.aiResponse,
      diceRoll: data.diceRoll,
      timestamp: new Date().toISOString()
    }]);

    if (data.audioBase64) {
      playAudio(data.audioBase64);
    }

    if (data.characterUpdate) {
      processCharacterUpdate(data.characterUpdate);
    }
  }

  async function handleTextSubmit(e) {
    e.preventDefault();
    if (!textInput.trim() || processing) return;

    const message = textInput.trim();
    setTextInput('');
    setProcessing(true);

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
      <div className="h-screen flex items-center justify-center">
        <div className="bg-animation" />
        <div className="stars" />
        <div className="grid-overlay" />
        <div className="spinner-large" />
      </div>
    );
  }

  const hpPercentage = character ? (character.hp / character.max_hp) * 100 : 100;

  return (
    <div className="h-screen flex flex-col relative">
      {/* Animated backgrounds */}
      <div className="bg-animation" />
      <div className="stars" />
      <div className="grid-overlay" />

      {/* Header */}
      <header className="glass-strong px-4 py-3 flex items-center gap-3 shrink-0 relative z-20">
        <button
          onClick={() => navigate(`/rol/room/${code}`)}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-sm truncate">{room?.name}</h1>
          <div className="text-xs text-gray-500">En partida</div>
        </div>

        {/* Online users */}
        <div className="flex -space-x-2">
          {roomUsers.slice(0, 4).map((u) => (
            <div
              key={u.odId}
              className={`w-9 h-9 rounded-xl bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-xs font-bold border-2 border-dark-bg transition-all ${
                speakingUsers.has(u.odId) ? 'ring-2 ring-neon-green speaking-indicator scale-110' : ''
              }`}
              title={u.username}
            >
              {u.username?.charAt(0).toUpperCase()}
            </div>
          ))}
          {roomUsers.length > 4 && (
            <div className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center text-xs border-2 border-dark-bg">
              +{roomUsers.length - 4}
            </div>
          )}
        </div>

        {/* Shop button */}
        {character && (
          <button
            onClick={() => setShowShop(true)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            title="Tienda"
          >
            <span className="text-xl">🏪</span>
          </button>
        )}

        {/* Character button */}
        {character && (
          <button
            onClick={() => setShowCharacter(true)}
            className="relative p-2 hover:bg-white/10 rounded-xl transition-colors group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform inline-block">🧙</span>
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-xs font-bold rounded-md bg-gradient-to-r from-neon-green to-emerald-400 text-black">
              {character.hp}
            </div>
            {/* Mini HP bar */}
            <div className="absolute bottom-0 left-1 right-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${hpPercentage > 50 ? 'bg-neon-green' : hpPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
          </button>
        )}
      </header>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`item-toast glass rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium
                ${notif.type === 'gold' ? 'text-yellow-400 border border-yellow-500/30' : ''}
                ${notif.type === 'item' ? 'text-neon-purple border border-neon-purple/30' : ''}
                ${notif.type === 'heal' ? 'text-neon-green border border-neon-green/30' : ''}
                ${notif.type === 'damage' ? 'text-red-400 border border-red-500/30' : ''}`}
            >
              <span className="text-lg">{notif.icon}</span>
              <span>{notif.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="text-6xl mb-4">🎭</div>
            <p className="text-gray-400 text-lg">La aventura esta a punto de comenzar...</p>
            <p className="text-gray-600 text-sm mt-2">Usa el microfono o escribe para hablar con el narrador</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.speaker === `user:${user.id}`} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="glass-strong p-4 shrink-0 relative z-20">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {/* Dice button */}
          <button
            onClick={() => setShowDice(true)}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30 hover:border-neon-purple hover:shadow-lg hover:shadow-neon-purple/20 flex items-center justify-center text-2xl shrink-0 transition-all hover:scale-105"
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
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder-gray-500 focus:border-neon-purple focus:outline-none focus:shadow-lg focus:shadow-neon-purple/10 transition-all"
              disabled={processing}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || processing}
              className="w-12 h-12 rounded-2xl bg-gradient-to-r from-neon-purple to-neon-pink hover:shadow-lg hover:shadow-neon-purple/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 disabled:hover:scale-100"
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

      {/* Shop Modal */}
      {showShop && character && (
        <ShopModal
          shopCode="general_store"
          characterId={character.id}
          gold={gold}
          onClose={() => setShowShop(false)}
          onGoldChange={setGold}
          onInventoryChange={() => {}}
        />
      )}
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  if (message.type === 'system') {
    return (
      <div className="text-center py-2 animate-fade-in">
        <span className="text-gray-500 text-sm bg-white/5 px-4 py-1 rounded-full">
          {message.text}
        </span>
      </div>
    );
  }

  if (message.type === 'dice') {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-enter`}>
        <div className="glass rounded-2xl p-4 max-w-xs">
          <div className="text-xs text-gray-400 mb-2 font-medium">{message.speakerName}</div>
          <div className="text-sm text-gray-300 mb-3">{message.text}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">🎲</span>
            {message.diceRoll?.results?.map((r, i) => (
              <span key={i} className="bg-gradient-to-r from-neon-purple to-neon-pink rounded-lg px-3 py-1 font-display font-bold text-lg dice-result">
                {r}
              </span>
            ))}
            {message.diceRoll?.modifier !== 0 && (
              <span className="text-gray-400 font-medium">
                {message.diceRoll.modifier > 0 ? '+' : ''}{message.diceRoll.modifier}
              </span>
            )}
            <span className="text-2xl font-bold text-neon-purple">=</span>
            <span className="text-3xl font-display font-black text-white">{message.diceRoll?.total}</span>
          </div>
        </div>
      </div>
    );
  }

  const isAI = message.type === 'ai';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isOwn ? 'slide-in-right' : 'slide-in-left'}`}>
      <div
        className={`rounded-2xl p-4 max-w-[85%] ${
          isAI
            ? 'ai-message rounded-tl-sm'
            : isOwn
            ? 'bg-gradient-to-r from-neon-purple to-neon-pink rounded-tr-sm'
            : 'glass rounded-tl-sm'
        }`}
      >
        {!isOwn && !isAI && (
          <div className="text-xs text-gray-400 mb-2 font-medium">{message.speakerName}</div>
        )}
        {isAI && (
          <div className="text-xs text-neon-purple mb-2 flex items-center gap-2 font-display font-bold tracking-wide">
            <span className="text-lg">🎭</span> NARRADOR
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</div>
        {message.diceRoll?.suggested && (
          <div className="mt-3 bg-black/30 rounded-xl p-3 text-xs border border-neon-purple/30">
            <span className="text-gray-400">Tirada sugerida:</span>{' '}
            <span className="text-neon-cyan font-display font-bold">{message.diceRoll.suggested}</span>
            {message.diceRoll.modifier !== 0 && (
              <span className="text-gray-400">
                {message.diceRoll.modifier > 0 ? '+' : ''}{message.diceRoll.modifier}
              </span>
            )}
            <span className="text-gray-400"> vs DC </span>
            <span className="text-neon-pink font-bold">{message.diceRoll.dc}</span>
          </div>
        )}
      </div>
    </div>
  );
}
