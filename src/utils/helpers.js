const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Format phone number to WhatsApp JID
 * @param {string} phone - Phone number
 * @param {boolean} isGroup - Is group JID
 * @returns {string} Formatted JID
 */
const formatJid = (phone, isGroup = false) => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Add country code if missing (assume Indonesia +62)
  if (cleaned.length <= 12 && !cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  // Return JID
  return isGroup ? `${cleaned}@g.us` : `${cleaned}@s.whatsapp.net`;
};

/**
 * Extract phone number from JID
 * @param {string} jid - WhatsApp JID
 * @returns {string} Phone number
 */
const extractPhone = (jid) => {
  if (!jid) return null;
  return jid.split('@')[0];
};

/**
 * Check if JID is a group
 * @param {string} jid - WhatsApp JID
 * @returns {boolean}
 */
const isGroupJid = (jid) => {
  return jid?.endsWith('@g.us');
};

/**
 * Generate random API key
 * @returns {string} API key
 */
const generateApiKey = () => {
  return `wag_${crypto.randomBytes(32).toString('hex')}`;
};

/**
 * Generate webhook signature
 * @param {string} payload - Request body
 * @param {string} secret - Webhook secret
 * @returns {string} HMAC signature
 */
const generateWebhookSignature = (payload, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
};

/**
 * Verify webhook signature
 * @param {string} payload - Request body
 * @param {string} signature - Received signature
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
const verifyWebhookSignature = (payload, signature, secret) => {
  const expected = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
};

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Get file extension from mimetype
 * @param {string} mimetype - MIME type
 * @returns {string} File extension
 */
const getExtFromMime = (mimetype) => {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return mimeMap[mimetype] || '';
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds
 * @returns {Promise}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Max retry attempts
 * @param {number} delay - Initial delay in ms
 * @returns {Promise}
 */
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i));
      }
    }
  }
  
  throw lastError;
};

/**
 * Format bytes to human readable
 * @param {number} bytes - Bytes
 * @returns {string}
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Sanitize filename
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

module.exports = {
  formatJid,
  extractPhone,
  isGroupJid,
  generateApiKey,
  generateWebhookSignature,
  verifyWebhookSignature,
  ensureDir,
  getExtFromMime,
  sleep,
  retryWithBackoff,
  formatBytes,
  sanitizeFilename,
};
