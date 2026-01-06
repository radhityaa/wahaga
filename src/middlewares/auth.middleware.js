const crypto = require('crypto');
const config = require('../config');
const { logger } = require('../utils/logger');

/**
 * Validate API key - supports both plain and SHA512 hashed format
 * API_KEY=sha512:{hash} or API_KEY={plain_key}
 */
const validateApiKey = (providedKey) => {
  const configuredKey = config.apiKey || config.masterApiKey;
  
  if (!configuredKey) {
    // No API key configured - allow all (development mode)
    logger.warn('No API key configured - API is unprotected!');
    return true;
  }
  
  if (!providedKey) {
    return false;
  }
  
  // Check if configured key is SHA512 hashed
  if (configuredKey.startsWith('sha512:')) {
    const hash = configuredKey.substring(7); // Remove 'sha512:' prefix
    const providedHash = crypto.createHash('sha512').update(providedKey).digest('hex');
    return hash === providedHash;
  }
  
  // Plain text comparison
  return providedKey === configuredKey;
};

/**
 * API Key authentication middleware
 * Validates X-Api-Key header against configured API key
 */
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!validateApiKey(apiKey)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
      error: 'Invalid or missing X-Api-Key header',
    });
  }

  req.apiKey = { name: 'master', permissions: ['*'] };
  next();
};

/**
 * Basic Auth middleware for Swagger
 */
const swaggerBasicAuth = (req, res, next) => {
  const { username, password } = config.swagger;
  
  // If no credentials configured, skip auth
  if (!username || !password) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
    return res.status(401).send('Authentication required');
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [providedUser, providedPass] = credentials.split(':');
  
  if (providedUser !== username || providedPass !== password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
    return res.status(401).send('Invalid credentials');
  }
  
  next();
};

/**
 * Basic Auth middleware for Dashboard
 * Only requires auth if DASHBOARD_USERNAME and DASHBOARD_PASSWORD are set
 */
const dashboardBasicAuth = (req, res, next) => {
  const { username, password, enabled } = config.dashboard;
  
  // If dashboard is disabled
  if (!enabled) {
    return res.status(404).json({ success: false, message: 'Dashboard is disabled' });
  }
  
  // If no credentials configured, skip auth (allow access without login)
  if (!username || !password || username === 'admin' && password === 'admin123') {
    // Skip default values - only require auth if explicitly set to non-default
    if (!process.env.DASHBOARD_USERNAME && !process.env.DASHBOARD_PASSWORD) {
      return next();
    }
  }
  
  // Check if credentials are explicitly set (not default)
  const hasCustomCredentials = process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD;
  if (!hasCustomCredentials) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required');
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [providedUser, providedPass] = credentials.split(':');
  
  if (providedUser !== username || providedPass !== password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Invalid credentials');
  }
  
  next();
};

/**
 * Generate HMAC signature for webhook payloads
 */
const generateHmacSignature = (payload) => {
  const secret = config.webhook.hmacSecret;
  if (!secret) return null;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return hmac.digest('hex');
};

/**
 * Verify HMAC signature from webhook
 */
const verifyHmacSignature = (payload, signature) => {
  const expectedSignature = generateHmacSignature(payload);
  if (!expectedSignature) return true; // No secret configured
  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSignature)
  );
};

module.exports = {
  apiKeyAuth,
  swaggerBasicAuth,
  dashboardBasicAuth,
  validateApiKey,
  generateHmacSignature,
  verifyHmacSignature,
};
