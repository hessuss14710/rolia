const API_BASE = '/rol/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('rolia_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('rolia_token', token);
    } else {
      localStorage.removeItem('rolia_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error de servidor');
    }

    return data;
  }

  // Auth
  async register(email, password, username) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username })
    });
    this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Rooms
  async getThemes() {
    return this.request('/rooms/themes');
  }

  async getRooms() {
    return this.request('/rooms');
  }

  async getRoom(code) {
    return this.request(`/rooms/code/${code}`);
  }

  async createRoom(name, theme, maxPlayers = 6) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, theme, maxPlayers })
    });
  }

  async joinRoom(code) {
    return this.request(`/rooms/join/${code}`, {
      method: 'POST'
    });
  }

  async leaveRoom(code) {
    return this.request(`/rooms/leave/${code}`, {
      method: 'POST'
    });
  }

  async updateRoomStatus(code, status) {
    return this.request(`/rooms/${code}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async deleteRoom(code) {
    return this.request(`/rooms/${code}`, {
      method: 'DELETE'
    });
  }

  // Characters
  async getMyCharacters() {
    return this.request('/characters');
  }

  async getRoomCharacter(roomCode) {
    return this.request(`/characters/room/${roomCode}`);
  }

  async getRoomCharacters(roomCode) {
    return this.request(`/characters/room/${roomCode}/all`);
  }

  async createCharacter(roomCode, name, characterClass, stats, background) {
    return this.request('/characters', {
      method: 'POST',
      body: JSON.stringify({ roomCode, name, characterClass, stats, background })
    });
  }

  async updateCharacter(id, updates) {
    return this.request(`/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async addInventoryItem(characterId, name, quantity = 1, description = '') {
    return this.request(`/characters/${characterId}/inventory`, {
      method: 'POST',
      body: JSON.stringify({ name, quantity, description })
    });
  }

  async removeInventoryItem(characterId, itemName, quantity = 1) {
    return this.request(`/characters/${characterId}/inventory/${encodeURIComponent(itemName)}`, {
      method: 'DELETE',
      body: JSON.stringify({ quantity })
    });
  }

  // Game
  async getGameHistory(roomCode, limit = 50, before = null) {
    const params = new URLSearchParams({ limit });
    if (before) params.append('before', before);
    return this.request(`/game/history/${roomCode}?${params}`);
  }

  async sendMessage(roomCode, message) {
    return this.request(`/game/message/${roomCode}`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  async rollDice(roomCode, dice, modifier = 0, reason = '') {
    return this.request(`/game/roll/${roomCode}`, {
      method: 'POST',
      body: JSON.stringify({ dice, modifier, reason })
    });
  }

  async sendVoice(roomCode, audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const url = `${API_BASE}/game/voice/${roomCode}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error al procesar audio');
    }
    return data;
  }

  async getLiveKitToken(roomCode) {
    return this.request(`/game/livekit-token/${roomCode}`);
  }

  async textToSpeech(text) {
    return this.request('/game/tts', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  }
}

export const api = new ApiService();
export default api;
