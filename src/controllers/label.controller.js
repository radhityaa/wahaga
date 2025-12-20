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
 * /api/labels/{sessionId}:
 *   get:
 *     tags: [Labels]
 *     summary: Get all labels (Business only)
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
 *         description: List of labels
 */
const getLabels = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const labels = await whatsappService.getLabels(session.name);
  res.json({ success: true, data: labels });
});

/**
 * @swagger
 * /api/labels/{sessionId}:
 *   post:
 *     tags: [Labels]
 *     summary: Create a new label (Business only)
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 7
 *                 default: 0
 *     responses:
 *       200:
 *         description: Label created
 */
const createLabel = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { name, color = 0 } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Label name is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.createLabel(session.name, name, color);
  res.json({ success: true, message: 'Label created', data: result });
});

/**
 * @swagger
 * /api/labels/{sessionId}/{labelId}:
 *   put:
 *     tags: [Labels]
 *     summary: Update a label (Business only)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: labelId
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
 *               name:
 *                 type: string
 *               color:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Label updated
 */
const updateLabel = asyncHandler(async (req, res) => {
  const { sessionId, labelId } = req.params;
  const { name, color } = req.body;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.updateLabel(session.name, labelId, name, color);
  res.json({ success: true, message: 'Label updated' });
});

/**
 * @swagger
 * /api/labels/{sessionId}/{labelId}:
 *   delete:
 *     tags: [Labels]
 *     summary: Delete a label (Business only)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: labelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Label deleted
 */
const deleteLabel = asyncHandler(async (req, res) => {
  const { sessionId, labelId } = req.params;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.deleteLabel(session.name, labelId);
  res.json({ success: true, message: 'Label deleted' });
});

/**
 * @swagger
 * /api/labels/{sessionId}/chats/{chatId}:
 *   get:
 *     tags: [Labels]
 *     summary: Get labels for a chat (Business only)
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
 *         description: Labels for chat
 */
const getLabelsForChat = asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const labels = await whatsappService.getLabelsForChat(session.name, chatId);
  res.json({ success: true, data: labels });
});

/**
 * @swagger
 * /api/labels/{sessionId}/chats/{chatId}:
 *   put:
 *     tags: [Labels]
 *     summary: Set labels for a chat (Business only)
 *     description: Set labels for a chat. All existing labels will be replaced.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - labels
 *             properties:
 *               labels:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *     responses:
 *       200:
 *         description: Labels set
 */
const setLabelsForChat = asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;
  const { labels = [] } = req.body;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const labelIds = labels.map(l => l.id);
  await whatsappService.setLabelsForChat(session.name, chatId, labelIds);
  res.json({ success: true, message: 'Labels set for chat' });
});

/**
 * @swagger
 * /api/labels/{sessionId}/{labelId}/chats:
 *   get:
 *     tags: [Labels]
 *     summary: Get chats by label (Business only)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: labelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chats with this label
 */
const getChatsByLabel = asyncHandler(async (req, res) => {
  const { sessionId, labelId } = req.params;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const chats = await whatsappService.getChatsByLabel(session.name, labelId);
  res.json({ success: true, data: chats });
});

module.exports = {
  getLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  getLabelsForChat,
  setLabelsForChat,
  getChatsByLabel,
};
