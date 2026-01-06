const NodeCache = require('node-cache');
const Redis = require('ioredis');
const config = require('../config');
const { logger } = require('../utils/logger');

class CacheService {
  constructor() {
    // Only use Redis if REDIS_URL is explicitly set and not empty
    const hasRedisUrl = config.redisUrl && config.redisUrl.trim() !== '';
    this.useRedis = hasRedisUrl && (config.env === 'production' || process.env.USE_REDIS === 'true');
    this.prefix = 'wag:';
    
    if (this.useRedis) {
      this.initRedis();
    } else {
      this.initNodeCache();
    }
  }

  /**
   * Initialize Redis client
   */
  initRedis() {
    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('error', (err) => {
      logger.error({ err }, 'Redis error');
    });
    
    // Connect
    this.redis.connect().catch((err) => {
      logger.error({ err }, 'Redis connection failed, falling back to node-cache');
      this.useRedis = false;
      this.initNodeCache();
    });
  }

  /**
   * Initialize NodeCache
   */
  initNodeCache() {
    this.nodeCache = new NodeCache({
      stdTTL: 600, // 10 minutes default TTL
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false,
    });
    logger.info('Using NodeCache for caching');
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>}
   */
  async get(key) {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useRedis) {
        const value = await this.redis.get(fullKey);
        return value ? JSON.parse(value) : null;
      } else {
        return this.nodeCache.get(fullKey) || null;
      }
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = 600) {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useRedis) {
        await this.redis.set(fullKey, JSON.stringify(value), 'EX', ttl);
      } else {
        this.nodeCache.set(fullKey, value, ttl);
      }
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Cache set error');
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async del(key) {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useRedis) {
        await this.redis.del(fullKey);
      } else {
        this.nodeCache.del(fullKey);
      }
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
      return false;
    }
  }

  /**
   * Delete keys by pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>}
   */
  async delByPattern(pattern) {
    const fullPattern = this.prefix + pattern;
    
    try {
      if (this.useRedis) {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return keys.length;
      } else {
        const keys = this.nodeCache.keys().filter((k) => k.startsWith(fullPattern.replace('*', '')));
        keys.forEach((k) => this.nodeCache.del(k));
        return keys.length;
      }
    } catch (error) {
      logger.error({ error, pattern }, 'Cache delete by pattern error');
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useRedis) {
        return (await this.redis.exists(fullKey)) === 1;
      } else {
        return this.nodeCache.has(fullKey);
      }
    } catch (error) {
      logger.error({ error, key }, 'Cache exists error');
      return false;
    }
  }

  /**
   * Flush all cache
   * @returns {Promise<boolean>}
   */
  async flush() {
    try {
      if (this.useRedis) {
        const keys = await this.redis.keys(this.prefix + '*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        this.nodeCache.flushAll();
      }
      return true;
    } catch (error) {
      logger.error({ error }, 'Cache flush error');
      return false;
    }
  }

  /**
   * Get cache stats
   * @returns {Promise<object>}
   */
  async getStats() {
    try {
      if (this.useRedis) {
        const info = await this.redis.info('stats');
        const keys = await this.redis.keys(this.prefix + '*');
        return {
          type: 'redis',
          keys: keys.length,
          info,
        };
      } else {
        return {
          type: 'node-cache',
          ...this.nodeCache.getStats(),
        };
      }
    } catch (error) {
      logger.error({ error }, 'Cache stats error');
      return { error: error.message };
    }
  }

  /**
   * Store group metadata for Baileys
   * @param {string} jid - Group JID
   * @param {object} metadata - Group metadata
   * @returns {Promise<boolean>}
   */
  async setGroupMetadata(jid, metadata) {
    return this.set(`group:${jid}`, metadata, 3600); // 1 hour TTL
  }

  /**
   * Get group metadata for Baileys
   * @param {string} jid - Group JID
   * @returns {Promise<object>}
   */
  async getGroupMetadata(jid) {
    return this.get(`group:${jid}`);
  }

  /**
   * Store message for getMessage callback
   * @param {string} sessionId - Session ID
   * @param {string} messageId - Message ID
   * @param {object} message - Message object
   * @returns {Promise<boolean>}
   */
  async setMessage(sessionId, messageId, message) {
    return this.set(`msg:${sessionId}:${messageId}`, message, 86400); // 24 hours TTL
  }

  /**
   * Get message for getMessage callback
   * @param {string} sessionId - Session ID
   * @param {string} messageId - Message ID
   * @returns {Promise<object>}
   */
  async getMessage(sessionId, messageId) {
    return this.get(`msg:${sessionId}:${messageId}`);
  }

  /**
   * Close cache connections
   */
  async close() {
    if (this.useRedis && this.redis) {
      await this.redis.quit();
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
