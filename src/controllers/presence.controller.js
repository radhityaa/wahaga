const whatsappService = require('../services/whatsapp.service');
const prisma = require('../config/prisma');
const asyncHandler = require('express-async-handler');

// Helper to get session
const getSession = async (sessionId) => {
  return prisma.session.findFirst({
    where: {
      OR: [{ id: sessionId }, { name: sessionId }],
      status: 'connected',
    },
  });
};

/**
 * @swagger
 * /api/presence/{sessionId}:
 *   post:
 *     tags: [Presence]
 *     summary: Set session presence
 *     description: "Set your online status. Use online/offline for global, or typing/recording/paused for chat-specific"
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - presence
 *             properties:
 *               presence:
 *                 type: string
 *                 enum: [online, offline, typing, recording, paused]
 *                 description: "online/offline = global, typing/recording/paused = needs chatId"
 *               chatId:
 *                 type: string
 *                 description: Required for typing/recording/paused
 *     responses:
 *       200:
 *         description: Presence set
 */
const setPresence = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { presence, chatId } = req.body;

  if (!presence) {
    return res.status(400).json({ success: false, message: 'Presence is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.setPresence(session.name, presence, chatId);
  res.json({ success: true, message: `Presence set to ${presence}` });
});

/**
 * @swagger
 * /api/presence/{sessionId}:
 *   get:
 *     tags: [Presence]
 *     summary: Get all subscribed presence information
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All presence information
 */
const getAllPresences = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const presences = await whatsappService.getAllPresences(session.name);
  res.json({ success: true, data: presences });
});

/**
 * @swagger
 * /api/presence/{sessionId}/{chatId}:
 *   get:
 *     tags: [Presence]
 *     summary: Get presence for a specific chat (auto-subscribes)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat JID (phone or group)
 *     responses:
 *       200:
 *         description: Chat presence information
 */
const getPresence = asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const presence = await whatsappService.getPresence(session.name, chatId);
  res.json({ success: true, data: presence });
});

/**
 * @swagger
 * /api/presence/{sessionId}/{chatId}/subscribe:
 *   post:
 *     tags: [Presence]
 *     summary: Subscribe to presence updates for a chat
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscribed to presence
 */
const subscribePresence = asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.subscribePresence(session.name, chatId);
  res.json({ success: true, message: 'Subscribed to presence updates' });
});

module.exports = {
  setPresence,
  getAllPresences,
  getPresence,
  subscribePresence,
};
