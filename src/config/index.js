const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // Database (SQLite built-in by default)
  databaseUrl: process.env.DATABASE_URL || 'file:./storage/whatsapp.db',
  
  // Redis (optional)
  redisUrl: process.env.REDIS_URL || null,
  
  // API Key - supports both plain and sha512 hashed format
  // API_KEY=sha512:{hash} or API_KEY={plain_key}
  apiKey: process.env.API_KEY,
  masterApiKey: process.env.API_KEY, // Alias for backward compatibility
  
  // Dashboard Security
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED !== 'false',
    username: process.env.DASHBOARD_USERNAME || null,
    password: process.env.DASHBOARD_PASSWORD || null,
  },
  
  // Swagger Security
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    username: process.env.SWAGGER_USERNAME || null,
    password: process.env.SWAGGER_PASSWORD || null,
  },
  
  // Webhook Security (HMAC)
  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 30000,
    retries: parseInt(process.env.WEBHOOK_RETRIES, 10) || 3,
    hmacSecret: process.env.WEBHOOK_HMAC_SECRET || null,
  },
  
  // WhatsApp
  whatsapp: {
    maxSessions: parseInt(process.env.WA_MAX_SESSIONS, 10) || 20,
    sessionDir: process.env.WA_SESSION_DIR || './storage/sessions',
    retryInterval: 5000, // 5 seconds
    maxRetries: 5,
  },
  
  // File Upload
  upload: {
    dir: process.env.UPLOAD_DIR || './storage/uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50000000, // 50MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/3gpp',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Paths
  paths: {
    root: path.resolve(__dirname, '../../'),
    storage: path.resolve(__dirname, '../../storage'),
    sessions: path.resolve(__dirname, '../../storage/sessions'),
    uploads: path.resolve(__dirname, '../../storage/uploads'),
  },
};

module.exports = config;

