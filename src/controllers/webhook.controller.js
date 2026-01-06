const webhookService = require('../services/webhook.service');
const { asyncHandler } = require('../middlewares/error.middleware');

/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     tags: [Webhooks]
 *     summary: List all webhooks
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of webhooks
 */
const listWebhooks = asyncHandler(async (req, res) => {
  const { sessionId, isActive } = req.query;
  
  const filter = {};
  if (sessionId) filter.sessionId = sessionId;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const webhooks = await webhookService.getWebhooks(filter);

  res.json({
    success: true,
    data: webhooks,
  });
});

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
 *     responses:
 *       200:
 *         description: Webhook details
 */
const getWebhook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const webhook = await webhookService.getWebhook(id);

  if (!webhook) {
    return res.status(404).json({
      success: false,
      message: 'Webhook not found',
    });
  }

  res.json({
    success: true,
    data: webhook,
  });
});

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     tags: [Webhooks]
 *     summary: Create webhook
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Webhook'
 *     responses:
 *       201:
 *         description: Webhook created
 */
const createWebhook = asyncHandler(async (req, res) => {
  const webhook = await webhookService.createWebhook(req.body);

  res.status(201).json({
    success: true,
    message: 'Webhook created',
    data: webhook,
  });
});

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
 *             $ref: '#/components/schemas/Webhook'
 *     responses:
 *       200:
 *         description: Webhook updated
 */
const updateWebhook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const webhook = await webhookService.updateWebhook(id, req.body);

  res.json({
    success: true,
    message: 'Webhook updated',
    data: webhook,
  });
});

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
const deleteWebhook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await webhookService.deleteWebhook(id);

  res.json({
    success: true,
    message: 'Webhook deleted',
  });
});

/**
 * @swagger
 * /api/webhooks/test:
 *   post:
 *     tags: [Webhooks]
 *     summary: Test webhook endpoint
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
 *               headers:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test result
 */
const testWebhook = asyncHandler(async (req, res) => {
  const { url, headers, payload } = req.body;

  const result = await webhookService.testWebhook(url, headers, payload);

  res.json({
    success: true,
    data: result,
  });
});

module.exports = {
  listWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
};
