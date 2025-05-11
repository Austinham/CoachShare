const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const http = require('http');

let io;

exports.initializeWebSocket = (app) => {
  const server = http.createServer(app);
  io = socketIo(server, {
    cors: {
      origin: process.env.NODE_ENV === 'development' 
        ? ['http://localhost:8080', 'http://localhost:8081']
        : process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: process.env.WS_PATH || '/socket.io',
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000
  });

  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return server;
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

exports.sendNotification = (userId, notification) => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  io.to(`user_${userId}`).emit('notification', notification);
}; 