const axios = require('axios');
const crypto = require('crypto');

const config = require('../config');
const { logger } = require('../utils/logger');
const { generateWebhookSignature, retryWithBackoff } = require('../utils/helpers');
const prisma = require('../config/prisma');

class WebhookService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 5;
    this.activeRequests = 0;
  }

  /**
   * Get all webhooks
   * @param {object} filter - Filter options
   * @returns {Promise<Array>}
   */
  async getWebhooks(filter = {}) {
    return prisma.webhook.findMany({
      where: filter,
      include: {
        session: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get webhook by ID
   * @param {string} id - Webhook ID
   * @returns {Promise<object>}
   */
  async getWebhook(id) {
    return prisma.webhook.findUnique({
      where: { id },
      include: {
        session: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Create webhook
   * @param {object} data - Webhook data
   * @returns {Promise<object>}
   */
  async createWebhook(data) {
    // Generate secret if not provided - use hmacSecret from WAHA or generate
    const secret = data.hmacSecret || data.secret || crypto.randomBytes(32).toString('hex');
    
    // Support both WAHA 'customHeaders' and legacy 'headers'
    const headers = data.customHeaders || data.headers || null;

    return prisma.webhook.create({
      data: {
        url: data.url,
        sessionId: data.sessionId || null,
        events: data.events || ['*'],
        headers: headers,
        secret: secret,
        isActive: data.isActive !== false,
        retries: data.retries || 3,
        // Store retry config in headers JSON as metadata (for future use)
        // retryDelay and retryPolicy can be stored as part of headers if needed
      },
    });
  }

  /**
   * Update webhook
   * @param {string} id - Webhook ID
   * @param {object} data - Update data
   * @returns {Promise<object>}
   */
  async updateWebhook(id, data) {
    return prisma.webhook.update({
      where: { id },
      data: {
        url: data.url,
        sessionId: data.sessionId,
        events: data.events,
        headers: data.headers,
        isActive: data.isActive,
        retries: data.retries,
      },
    });
  }

  /**
   * Delete webhook
   * @param {string} id - Webhook ID
   * @returns {Promise<object>}
   */
  async deleteWebhook(id) {
    return prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * Dispatch event to webhooks
   * @param {string} sessionName - Session name
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   */
  async dispatch(sessionName, eventType, data) {
    try {
      // Find matching webhooks
      const webhooks = await prisma.webhook.findMany({
        where: {
          isActive: true,
          OR: [
            { sessionId: null }, // Global webhooks
            {
              session: {
                name: sessionName,
              },
            },
          ],
        },
      });

      for (const webhook of webhooks) {
        // Check if event matches
        const events = webhook.events || ['*'];
        const matches = events.includes('*') || 
                        events.includes(eventType) ||
                        events.some(e => eventType.startsWith(e.replace('*', '')));

        if (matches) {
          this.queueWebhook(webhook, sessionName, eventType, data);
        }
      }
    } catch (error) {
      logger.error({ error, sessionName, eventType }, 'Failed to dispatch webhook');
    }
  }

  /**
   * Queue webhook for delivery
   * @param {object} webhook - Webhook config
   * @param {string} sessionName - Session name
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   */
  queueWebhook(webhook, sessionName, eventType, data) {
    this.queue.push({
      webhook,
      sessionName,
      eventType,
      data,
      timestamp: new Date().toISOString(),
    });

    this.processQueue();
  }

  /**
   * Process webhook queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const item = this.queue.shift();
      this.activeRequests++;
      
      this.sendWebhook(item)
        .finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
    }

    this.processing = false;
  }

  /**
   * Send webhook request
   * @param {object} item - Queue item
   */
  async sendWebhook(item) {
    const { webhook, sessionName, eventType, data, timestamp } = item;
    
    const payload = {
      event: eventType,
      session: sessionName,
      timestamp,
      data,
    };

    // Generate signature
    const signature = generateWebhookSignature(payload, webhook.secret);

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': eventType,
      'X-Webhook-Session': sessionName,
      ...(webhook.headers || {}),
    };

    try {
      const response = await retryWithBackoff(
        async () => {
          return axios.post(webhook.url, payload, {
            headers,
            timeout: config.webhook.timeout,
          });
        },
        webhook.retries,
        1000
      );

      // Update webhook stats
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          lastStatus: response.status,
          failCount: 0,
        },
      });

      logger.debug({ webhookId: webhook.id, eventType, status: response.status }, 'Webhook delivered');
    } catch (error) {
      logger.error({ 
        error: error.message, 
        webhookId: webhook.id, 
        url: webhook.url,
        eventType 
      }, 'Webhook delivery failed');

      // Update fail count
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          lastStatus: error.response?.status || 0,
          failCount: { increment: 1 },
        },
      });

      // Disable webhook if too many failures
      const updated = await prisma.webhook.findUnique({
        where: { id: webhook.id },
        select: { failCount: true },
      });

      if (updated && updated.failCount >= 10) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { isActive: false },
        });
        logger.warn({ webhookId: webhook.id }, 'Webhook disabled due to repeated failures');
      }
    }
  }

  /**
   * Test webhook
   * @param {string} url - Webhook URL
   * @param {object} headers - Custom headers
   * @param {object} customPayload - Custom payload (optional)
   * @returns {Promise<object>}
   */
  async testWebhook(url, headers = {}, customPayload = null) {
    const payload = customPayload || {
      event: 'test',
      session: 'test-session',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from WhatsApp Gateway',
        testId: `test-${Date.now()}`,
      },
    };

    const secret = 'test-secret';
    const signature = generateWebhookSignature(payload, secret);

    const startTime = Date.now();
    
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event || 'test',
          'X-Webhook-Test': 'true',
          ...headers,
        },
        timeout: config.webhook.timeout,
        validateStatus: () => true, // Accept any status code
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        requestPayload: payload,
        responseData: typeof response.data === 'object' ? response.data : { raw: response.data },
        responseHeaders: response.headers,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        status: error.response?.status || 0,
        statusText: error.response?.statusText || 'Connection Failed',
        responseTime,
        error: error.message,
        errorCode: error.code,
        requestPayload: payload,
      };
    }
  }
}

// Singleton
const webhookService = new WebhookService();

module.exports = webhookService;
