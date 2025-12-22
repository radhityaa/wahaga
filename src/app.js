require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { defaultLimiter } = require('./middlewares/rateLimit.middleware');
const { swaggerBasicAuth, dashboardBasicAuth } = require('./middlewares/auth.middleware');
const { logger } = require('./utils/logger');
const { ensureDir } = require('./utils/helpers');
const { initWebSocket } = require('./websocket');
const whatsappService = require('./services/whatsapp.service');
const webhookService = require('./services/webhook.service');

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize WebSocket
initWebSocket(server);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for swagger UI
}));

// CORS - Allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api', defaultLimiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    }, 'Request completed');
  });
  next();
});

// Dashboard with optional basic auth (only if DASHBOARD_USERNAME/PASSWORD set)
if (config.dashboard.enabled) {
  app.use('/dashboard', dashboardBasicAuth, express.static(path.join(__dirname, '../public/dashboard')));
  app.get('/dashboard/*', dashboardBasicAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard/index.html'));
  });
}

// Static files for uploaded images
app.use('/images', express.static(path.join(__dirname, '../storage/uploads')));

// Swagger documentation with optional basic auth
if (config.swagger.enabled) {
  app.use('/api-docs', swaggerBasicAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'WhatsApp Gateway API Docs',
  }));
}

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Gateway API',
    version: '1.0.0',
    documentation: '/api-docs',
    dashboard: '/dashboard',
    health: '/api/health',
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Ensure storage directories exist
ensureDir(config.paths.sessions);
ensureDir(config.paths.uploads);

// Register webhook dispatch for WhatsApp events
whatsappService.onEvent(async (sessionName, event, data) => {
  // Dispatch to webhooks
  await webhookService.dispatch(sessionName, event, data);

  // Log event to database
  const prisma = require('./config/prisma');
  
  try {
    const session = await prisma.session.findUnique({
      where: { name: sessionName },
    });
    
    if (session) {
      await prisma.event.create({
        data: {
          sessionId: session.id,
          type: event,
          data: JSON.parse(JSON.stringify(data)),
        },
      });
    }
  } catch (error) {
    logger.error({ error, sessionName, event }, 'Failed to log event');
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  
  // Cleanup WhatsApp sessions
  await whatsappService.cleanup();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const startServer = async () => {
  try {
    // Setup default webhook from environment
    const defaultWebhookUrl = process.env.WEBHOOK_URL || process.env.DEFAULT_WEBHOOK_URL;
    if (defaultWebhookUrl) {
      const events = (process.env.WEBHOOK_EVENTS || process.env.DEFAULT_WEBHOOK_EVENTS || '*').split(',').map(e => e.trim());
      
      // Check if default webhook already exists
      const existingWebhooks = await webhookService.getWebhooks({ url: defaultWebhookUrl });
      if (existingWebhooks.length === 0) {
        await webhookService.createWebhook({
          url: defaultWebhookUrl,
          events: events,
          isActive: true,
          retries: 3,
        });
        logger.info({ url: defaultWebhookUrl, events }, 'Default webhook created from environment');
      }
    }
    
    // Initialize existing sessions
    await whatsappService.initializeSessions();
    
    // Start listening
    server.listen(config.port, () => {
      logger.info({
        port: config.port,
        env: config.env,
        docs: `http://localhost:${config.port}/api-docs`,
        dashboard: `http://localhost:${config.port}/dashboard`,
      }, 'WhatsApp Gateway API started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

module.exports = app;