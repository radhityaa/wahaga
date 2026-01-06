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
 * /api/channels/{sessionId}:
 *   get:
 *     tags: [Channels]
 *     summary: Get list of subscribed channels
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
 *         description: List of channels
 */
const getChannels = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const channels = await whatsappService.getChannels(session.name);
  res.json({ success: true, data: channels });
});

/**
 * @swagger
 * /api/channels/{sessionId}:
 *   post:
 *     tags: [Channels]
 *     summary: Create a new channel
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
 *                 description: Channel name
 *               description:
 *                 type: string
 *                 description: Channel description
 *     responses:
 *       200:
 *         description: Channel created
 */
const createChannel = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Channel name is required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.createChannel(session.name, name, description);
  res.json({ success: true, message: 'Channel created', data: result });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}:
 *   delete:
 *     tags: [Channels]
 *     summary: Delete a channel
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel JID
 *     responses:
 *       200:
 *         description: Channel deleted
 */
const deleteChannel = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.deleteChannel(session.name, channelId);
  res.json({ success: true, message: 'Channel deleted' });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}/info:
 *   get:
 *     tags: [Channels]
 *     summary: Get channel info
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel JID or invite code
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [jid, invite]
 *           default: jid
 *         description: Type of channelId (jid or invite code)
 *     responses:
 *       200:
 *         description: Channel info
 */
const getChannelInfo = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const { type = 'jid' } = req.query;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const info = await whatsappService.getChannelInfo(session.name, channelId, type);
  res.json({ success: true, data: info });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}/messages:
 *   get:
 *     tags: [Channels]
 *     summary: Preview channel messages
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Channel messages
 */
const getChannelMessages = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const { count = 50 } = req.query;

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const messages = await whatsappService.getChannelMessages(session.name, channelId, parseInt(count));
  res.json({ success: true, data: messages });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}/follow:
 *   post:
 *     tags: [Channels]
 *     summary: Follow a channel
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel followed
 */
const followChannel = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.followChannel(session.name, channelId);
  res.json({ success: true, message: 'Channel followed' });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}/unfollow:
 *   post:
 *     tags: [Channels]
 *     summary: Unfollow a channel
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel unfollowed
 */
const unfollowChannel = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.unfollowChannel(session.name, channelId);
  res.json({ success: true, message: 'Channel unfollowed' });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}/mute:
 *   post:
 *     tags: [Channels]
 *     summary: Mute a channel
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel muted
 */
const muteChannel = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.muteChannel(session.name, channelId);
  res.json({ success: true, message: 'Channel muted' });
});

/**
 * @swagger
 * /api/channels/{sessionId}/{channelId}/unmute:
 *   post:
 *     tags: [Channels]
 *     summary: Unmute a channel
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel unmuted
 */
const unmuteChannel = asyncHandler(async (req, res) => {
  const { sessionId, channelId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.unmuteChannel(session.name, channelId);
  res.json({ success: true, message: 'Channel unmuted' });
});

module.exports = {
  getChannels,
  createChannel,
  deleteChannel,
  getChannelInfo,
  getChannelMessages,
  followChannel,
  unfollowChannel,
  muteChannel,
  unmuteChannel,
};
