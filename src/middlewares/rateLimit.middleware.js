const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Default rate limiter
 */
const defaultLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minute
  max: config.rateLimit.maxRequests, // 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests',
    error: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key or IP as rate limit key
    return req.headers['x-api-key'] || req.ip;
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    message: 'Too many requests',
    error: 'Rate limit exceeded for this endpoint.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Message sending rate limiter
 * Prevent spam/abuse
 */
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute per session
  message: {
    success: false,
    message: 'Too many messages',
    error: 'Message rate limit exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per session
    const sessionId = req.body?.sessionId || req.params?.sessionId || 'unknown';
    const apiKey = req.headers['x-api-key'] || req.ip;
    return `${apiKey}:${sessionId}`;
  },
});

/**
 * Auth rate limiter
 * Prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts',
    error: 'Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

module.exports = {
  defaultLimiter,
  strictLimiter,
  messageLimiter,
  authLimiter,
};
