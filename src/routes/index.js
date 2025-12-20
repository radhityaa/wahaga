const express = require('express');
const router = express.Router();

// Import route modules
const sessionRoutes = require('./session.routes');
const messageRoutes = require('./message.routes');
const groupRoutes = require('./group.routes');
const webhookRoutes = require('./webhook.routes');
const dashboardRoutes = require('./dashboard.routes');
const contactRoutes = require('./contact.routes');
const channelRoutes = require('./channel.routes');
const statusRoutes = require('./status.routes');
const presenceRoutes = require('./presence.routes');
const labelRoutes = require('./label.routes');
const eventRoutes = require('./event.routes');

const config = require('../config');

// Health check (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Gateway API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Dashboard login (no auth required)
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === config.dashboard.username && password === config.dashboard.password) {
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        apiKey: config.masterApiKey,
        username: username,
      },
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password',
    });
  }
});

// Get current user/session info (requires API key)
router.get('/me', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.masterApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
  
  res.json({
    success: true,
    data: {
      username: config.dashboard.username,
      role: 'admin',
      apiKey: apiKey,
    },
  });
});

// Mount routes
router.use('/sessions', sessionRoutes);
router.use('/messages', messageRoutes);
router.use('/groups', groupRoutes);
router.use('/contacts', contactRoutes);
router.use('/channels', channelRoutes);
router.use('/status', statusRoutes);
router.use('/presence', presenceRoutes);
router.use('/labels', labelRoutes);
router.use('/events', eventRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
