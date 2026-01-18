const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const roomsRoutes = require('./routes/rooms');
const charactersRoutes = require('./routes/characters');
const gameRoutes = require('./routes/game');
const { authenticateToken, authenticateSocket } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io/'
});

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test database connection
pool.query('SELECT NOW()')
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Database connection error:', err));

// Make pool available to routes
app.set('db', pool);
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rolia-backend' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/rooms', authenticateToken, roomsRoutes);
app.use('/characters', authenticateToken, charactersRoutes);
app.use('/game', authenticateToken, gameRoutes);

// Socket.IO authentication middleware
io.use(authenticateSocket);

// Room management for Socket.IO
const roomUsers = new Map(); // roomCode -> Set of { odId, username }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.user.id})`);

  // Join a game room
  socket.on('join-room', async (roomCode) => {
    try {
      // Verify user is participant
      const result = await pool.query(
        `SELECT r.id, r.name, r.theme, r.status FROM rooms r
         JOIN room_participants rp ON r.id = rp.room_id
         WHERE r.code = $1 AND rp.user_id = $2`,
        [roomCode, socket.user.id]
      );

      if (result.rows.length === 0) {
        socket.emit('error', { message: 'No tienes acceso a esta sala' });
        return;
      }

      socket.join(roomCode);
      socket.roomCode = roomCode;

      // Track user in room
      if (!roomUsers.has(roomCode)) {
        roomUsers.set(roomCode, new Map());
      }
      roomUsers.get(roomCode).set(socket.user.id, {
        odId: socket.user.id,
        username: socket.user.username,
        socketId: socket.id
      });

      // Notify others
      socket.to(roomCode).emit('user-joined', {
        userId: socket.user.id,
        username: socket.user.username
      });

      // Send current users list
      socket.emit('room-users', Array.from(roomUsers.get(roomCode).values()));

      console.log(`${socket.user.username} joined room ${roomCode}`);
    } catch (err) {
      console.error('Error joining room:', err);
      socket.emit('error', { message: 'Error al unirse a la sala' });
    }
  });

  // Leave room
  socket.on('leave-room', () => {
    if (socket.roomCode) {
      handleLeaveRoom(socket);
    }
  });

  // Chat message (text)
  socket.on('chat-message', async (data) => {
    if (!socket.roomCode) return;

    // Save to history
    const roomResult = await pool.query('SELECT id FROM rooms WHERE code = $1', [socket.roomCode]);
    if (roomResult.rows.length > 0) {
      await pool.query(
        'INSERT INTO game_history (room_id, speaker, message) VALUES ($1, $2, $3)',
        [roomResult.rows[0].id, `user:${socket.user.id}`, data.message]
      );
    }

    // Broadcast to room
    io.to(socket.roomCode).emit('chat-message', {
      userId: socket.user.id,
      username: socket.user.username,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });

  // Dice roll
  socket.on('dice-roll', async (data) => {
    if (!socket.roomCode) return;

    const { dice, modifier = 0, reason = '' } = data;
    const results = rollDice(dice);
    const total = results.reduce((a, b) => a + b, 0) + modifier;

    // Save to history
    const roomResult = await pool.query('SELECT id FROM rooms WHERE code = $1', [socket.roomCode]);
    if (roomResult.rows.length > 0) {
      await pool.query(
        'INSERT INTO game_history (room_id, speaker, message, dice_roll) VALUES ($1, $2, $3, $4)',
        [roomResult.rows[0].id, `user:${socket.user.id}`, reason, JSON.stringify({ dice, results, modifier, total })]
      );
    }

    // Broadcast result
    io.to(socket.roomCode).emit('dice-result', {
      userId: socket.user.id,
      username: socket.user.username,
      dice,
      results,
      modifier,
      total,
      reason,
      timestamp: new Date().toISOString()
    });
  });

  // Voice activity indicators
  socket.on('speaking-start', () => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('user-speaking', {
        odId: socket.user.id,
        username: socket.user.username,
        speaking: true
      });
    }
  });

  socket.on('speaking-stop', () => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('user-speaking', {
        odId: socket.user.id,
        username: socket.user.username,
        speaking: false
      });
    }
  });

  // AI response received (broadcast to room)
  socket.on('ai-response', (data) => {
    if (socket.roomCode) {
      io.to(socket.roomCode).emit('ai-message', data);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
    if (socket.roomCode) {
      handleLeaveRoom(socket);
    }
  });
});

function handleLeaveRoom(socket) {
  const roomCode = socket.roomCode;

  if (roomUsers.has(roomCode)) {
    roomUsers.get(roomCode).delete(socket.user.id);
    if (roomUsers.get(roomCode).size === 0) {
      roomUsers.delete(roomCode);
    }
  }

  socket.to(roomCode).emit('user-left', {
    userId: socket.user.id,
    username: socket.user.username
  });

  socket.leave(roomCode);
  socket.roomCode = null;
}

function rollDice(diceString) {
  // Parse dice string like "2d6", "1d20", "3d8"
  const match = diceString.match(/(\d+)d(\d+)/i);
  if (!match) return [0];

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const results = [];

  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }

  return results;
}

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`RolIA Backend running on port ${PORT}`);
});
