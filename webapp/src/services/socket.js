import { io } from 'socket.io-client';
import api from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return;

    const token = api.getToken();
    if (!token) {
      console.error('No token for socket connection');
      return;
    }

    this.socket = io(window.location.origin, {
      path: '/rol/socket.io/',
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomCode) {
    if (!this.socket) this.connect();
    this.socket.emit('join-room', roomCode);
  }

  leaveRoom() {
    if (this.socket) {
      this.socket.emit('leave-room');
    }
  }

  sendMessage(message) {
    if (this.socket) {
      this.socket.emit('chat-message', { message });
    }
  }

  rollDice(dice, modifier = 0, reason = '') {
    if (this.socket) {
      this.socket.emit('dice-roll', { dice, modifier, reason });
    }
  }

  startSpeaking() {
    if (this.socket) {
      this.socket.emit('speaking-start');
    }
  }

  stopSpeaking() {
    if (this.socket) {
      this.socket.emit('speaking-stop');
    }
  }

  on(event, callback) {
    if (!this.socket) this.connect();
    this.socket.on(event, callback);

    // Track listeners for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) callbacks.splice(index, 1);
        }
      } else {
        this.socket.off(event);
        this.listeners.delete(event);
      }
    }
  }

  removeAllListeners() {
    if (this.socket) {
      for (const [event] of this.listeners) {
        this.socket.off(event);
      }
      this.listeners.clear();
    }
  }
}

export const socketService = new SocketService();
export default socketService;
