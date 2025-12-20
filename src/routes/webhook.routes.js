const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { apiKeyAuth } = require('../middlewares/auth.middleware');
const { validate, webhookSchemas } = require('../middlewares/validation.middleware');

// Apply API key auth to all routes
router.use(apiKeyAuth);

/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     tags: [Webhooks]
 *     summary: List all webhooks
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 */
router.get('/', webhookController.listWebhooks);

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     tags: [Webhooks]
 *     summary: Create new webhook
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook URL
 *                 example: https://example.com/webhook
 *               sessionId:
 *                 type: string
 *                 description: Optional session ID to filter events
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Events to subscribe to
 *                 example: ["message.received", "connection.open"]
 *               headers:
 *                 type: object
 *                 description: Custom headers to send
 *               secret:
 *                 type: string
 *                 description: Secret for HMAC signature
 *               retries:
 *                 type: integer
 *                 description: Number of retries on failure
 *                 default: 3
 *     responses:
 *       201:
 *         description: Webhook created
 */
router.post('/', validate(webhookSchemas.create), webhookController.createWebhook);

/**
 * @swagger
 * /api/webhooks/test:
 *   post:
 *     tags: [Webhooks]
 *     summary: Test webhook URL
 *     description: Send a test payload to a webhook URL to verify it's working correctly
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL to test
 *                 example: https://example.com/webhook
 *               headers:
 *                 type: object
 *                 description: Custom headers to include
 *               payload:
 *                 type: object
 *                 description: Custom payload (optional, will use default test payload if not provided)
 *     responses:
 *       200:
 *         description: Test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     status:
 *                       type: integer
 *                     responseTime:
 *                       type: integer
 *                     error:
 *                       type: string
 */
router.post('/test', validate(webhookSchemas.test), webhookController.testWebhook);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get webhook details
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     responses:
 *       200:
 *         description: Webhook details
 */
router.get('/:id', webhookController.getWebhook);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   put:
 *     tags: [Webhooks]
 *     summary: Update webhook
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook updated
 */
router.put('/:id', validate(webhookSchemas.update), webhookController.updateWebhook);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   delete:
 *     tags: [Webhooks]
 *     summary: Delete webhook
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook deleted
 */
router.delete('/:id', webhookController.deleteWebhook);

module.exports = router;

