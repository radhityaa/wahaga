const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { apiKeyAuth } = require('../middlewares/auth.middleware');

// All dashboard routes require API key auth
router.use(apiKeyAuth);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard statistics
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
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
 *                     sessions:
 *                       type: object
 *                     messages:
 *                       type: object
 *                     webhooks:
 *                       type: object
 */
router.get('/stats', dashboardController.getStats);

/**
 * @swagger
 * /api/dashboard/system:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get system metrics
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: System metrics (memory, CPU, uptime)
 */
router.get('/system', dashboardController.getSystemMetrics);

/**
 * @swagger
 * /api/dashboard/events:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get recent events
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of events to return
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Filter by session ID
 *     responses:
 *       200:
 *         description: List of recent events
 */
router.get('/events', dashboardController.getEvents);

/**
 * @swagger
 * /api/dashboard/events:
 *   delete:
 *     tags: [Dashboard]
 *     summary: Clear all events (logs)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Optional - only clear events for a specific session
 *     responses:
 *       200:
 *         description: Events cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: integer
 */
router.delete('/events', dashboardController.clearEvents);

/**
 * @swagger
 * /api/dashboard/messages/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get message statistics
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to include
 *     responses:
 *       200:
 *         description: Message statistics
 */
router.get('/messages/stats', dashboardController.getMessageStats);

/**
 * @swagger
 * /api/dashboard/sessions/live:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get live session states
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Live session states
 */
router.get('/sessions/live', dashboardController.getLiveSessions);

module.exports = router;
