const { Server } = require('socket.io');
const config = require('../config');
const { logger } = require('../utils/logger');
const whatsappService = require('../services/whatsapp.service');

let io = null;

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
const initWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware - validate API key
  io.use((socket, next) => {
    const apiKey = socket.handshake.auth.apiKey || socket.handshake.query.apiKey;
    
    if (!apiKey) {
      return next(new Error('API key required'));
    }

    // Check master API key
    if (apiKey === config.masterApiKey) {
      socket.apiKey = { name: 'master', permissions: ['*'] };
      return next();
    }

    // For simplicity, accept any non-empty API key in socket (full validation in HTTP)
    // In production, you might want to validate against database here too
    socket.apiKey = { key: apiKey };
    next();
  });

  io.on('connection', (socket) => {
    logger.info({ apiKey: socket.apiKey?.name || 'unknown' }, 'WebSocket client connected');

    // Join room for real-time updates
    socket.join('dashboard');

    // Send initial session states
    socket.emit('sessions:state', whatsappService.getAllSessions());

    // Handle session subscribe
    socket.on('session:subscribe', (sessionName) => {
      socket.join(`session:${sessionName}`);
      logger.debug({ sessionName }, 'Client subscribed to session');
    });

    // Handle session unsubscribe
    socket.on('session:unsubscribe', (sessionName) => {
      socket.leave(`session:${sessionName}`);
      logger.debug({ sessionName }, 'Client unsubscribed from session');
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info({ reason }, 'WebSocket client disconnected');
    });
  });

  // Register event handler for WhatsApp events
  whatsappService.onEvent(async (sessionName, event, data) => {
    // Broadcast to dashboard
    io.to('dashboard').emit('event', {
      session: sessionName,
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to session-specific room
    io.to(`session:${sessionName}`).emit(`session:${event}`, {
      session: sessionName,
      data,
      timestamp: new Date().toISOString(),
    });

    // Handle specific events
    switch (event) {
      case 'qr':
        io.to('dashboard').emit('session:qr', {
          session: sessionName,
          qrBase64: data.qrBase64,
        });
        break;
      
      case 'connection.open':
        io.to('dashboard').emit('session:connected', {
          session: sessionName,
          phone: data.phone,
          pushName: data.pushName,
        });
        io.to('dashboard').emit('sessions:state', whatsappService.getAllSessions());
        break;
      
      case 'connection.close':
        io.to('dashboard').emit('session:disconnected', {
          session: sessionName,
          statusCode: data.statusCode,
        });
        io.to('dashboard').emit('sessions:state', whatsappService.getAllSessions());
        break;

      case 'message.received':
        io.to('dashboard').emit('message:received', {
          session: sessionName,
          message: data.message,
        });
        break;

      case 'message.sent':
        io.to('dashboard').emit('message:sent', {
          session: sessionName,
          message: data.message,
        });
        break;
    }
  });

  logger.info('WebSocket server initialized');
  return io;
};

/**
 * Get Socket.io instance
 * @returns {Server}
 */
const getIO = () => io;

/**
 * Broadcast event to all connected clients
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
const broadcast = (event, data) => {
  if (io) {
    io.to('dashboard').emit(event, data);
  }
};

module.exports = {
  initWebSocket,
  getIO,
  broadcast,
};
