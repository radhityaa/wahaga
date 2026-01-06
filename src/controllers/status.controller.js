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
 * /api/status/{sessionId}/new-message-id:
 *   get:
 *     tags: [Status]
 *     summary: Generate new message ID for batch status sending
 *     description: Generate a message ID to use when sending status to many contacts in batches
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
 *         description: New message ID generated
 */
const generateMessageId = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const id = await whatsappService.generateStatusMessageId(session.name);
  res.json({ success: true, data: { id } });
});

/**
 * @swagger
 * /api/status/{sessionId}/text:
 *   post:
 *     tags: [Status]
 *     summary: Send text status/story
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
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Status text
 *               backgroundColor:
 *                 type: string
 *                 default: "#000000"
 *                 description: Background color (hex)
 *               font:
 *                 type: integer
 *                 default: 0
 *                 description: Font type (0-5)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific contacts to show status to
 *               messageId:
 *                 type: string
 *                 description: Custom message ID for batch sending
 *     responses:
 *       200:
 *         description: Text status sent
 */
const sendTextStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { text, backgroundColor, font, contacts, messageId } = req.body;

  if (!text) {
    return res.status(400).json({ success: false, message: 'Text is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.sendTextStatus(session.name, text, {
    backgroundColor,
    font,
    contacts,
    messageId,
  });

  res.json({ success: true, message: 'Text status sent', data: result });
});

/**
 * @swagger
 * /api/status/{sessionId}/image:
 *   post:
 *     tags: [Status]
 *     summary: Send image status/story
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
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 description: Image URL or base64
 *               caption:
 *                 type: string
 *                 description: Image caption
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *               messageId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image status sent
 */
const sendImageStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { imageUrl, caption, contacts, messageId } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'Image URL is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.sendImageStatus(session.name, imageUrl, {
    caption,
    contacts,
    messageId,
  });

  res.json({ success: true, message: 'Image status sent', data: result });
});

/**
 * @swagger
 * /api/status/{sessionId}/video:
 *   post:
 *     tags: [Status]
 *     summary: Send video status/story
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
 *               - videoUrl
 *             properties:
 *               videoUrl:
 *                 type: string
 *                 description: Video URL or base64
 *               caption:
 *                 type: string
 *                 description: Video caption
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *               messageId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Video status sent
 */
const sendVideoStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { videoUrl, caption, contacts, messageId } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, message: 'Video URL is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.sendVideoStatus(session.name, videoUrl, {
    caption,
    contacts,
    messageId,
  });

  res.json({ success: true, message: 'Video status sent', data: result });
});

/**
 * @swagger
 * /api/status/{sessionId}/voice:
 *   post:
 *     tags: [Status]
 *     summary: Send voice status/story
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
 *               - audioUrl
 *             properties:
 *               audioUrl:
 *                 type: string
 *                 description: Audio URL or base64 (OGG/MP3)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *               messageId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Voice status sent
 */
const sendVoiceStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { audioUrl, contacts, messageId } = req.body;

  if (!audioUrl) {
    return res.status(400).json({ success: false, message: 'Audio URL is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.sendVoiceStatus(session.name, audioUrl, {
    contacts,
    messageId,
  });

  res.json({ success: true, message: 'Voice status sent', data: result });
});

/**
 * @swagger
 * /api/status/{sessionId}/delete:
 *   post:
 *     tags: [Status]
 *     summary: Delete a sent status
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
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 description: Status message ID (from send response key.id)
 *     responses:
 *       200:
 *         description: Status deleted
 */
const deleteStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Status ID is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.deleteStatus(session.name, id);
  res.json({ success: true, message: 'Status deleted' });
});

module.exports = {
  generateMessageId,
  sendTextStatus,
  sendImageStatus,
  sendVideoStatus,
  sendVoiceStatus,
  deleteStatus,
};
