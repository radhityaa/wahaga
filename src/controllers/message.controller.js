const path = require('path');
const fs = require('fs');
const whatsappService = require('../services/whatsapp.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const config = require('../config');
const prisma = require('../config/prisma');

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     tags: [Messages]
 *     summary: Send text message
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       200:
 *         description: Message sent
 */
const sendText = asyncHandler(async (req, res) => {
  const { sessionId, to, text, quotedMessageId, mentions } = req.body;

  // Find session
  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  const options = {};
  if (quotedMessageId) {
    options.quoted = { key: { id: quotedMessageId } };
  }
  if (mentions) {
    options.mentions = mentions;
  }

  const result = await whatsappService.sendText(session.name, to, text, options);

  // Log to database
  await prisma.message.create({
    data: {
      sessionId: session.id,
      messageId: result.key.id,
      remoteJid: result.key.remoteJid,
      fromMe: true,
      type: 'text',
      content: text,
      status: 'sent',
      timestamp: new Date(),
    },
  });

  res.json({
    success: true,
    message: 'Message sent',
    data: {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      status: 'sent',
    },
  });
});

/**
 * @swagger
 * /api/messages/send-media:
 *   post:
 *     tags: [Messages]
 *     summary: Send media message (image, video, audio, document)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMediaRequest'
 *     responses:
 *       200:
 *         description: Media sent
 */
const sendMedia = asyncHandler(async (req, res) => {
  const { sessionId, to, type, mediaUrl, mediaBase64, caption, filename, mimetype, ptt } = req.body;

  // Find session
  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  // Determine media source
  let media;
  if (mediaBase64) {
    media = Buffer.from(mediaBase64, 'base64');
  } else {
    media = mediaUrl;
  }

  const result = await whatsappService.sendMedia(session.name, to, type, media, {
    caption,
    filename,
    mimetype,
    ptt,
  });

  // Log to database
  await prisma.message.create({
    data: {
      sessionId: session.id,
      messageId: result.key.id,
      remoteJid: result.key.remoteJid,
      fromMe: true,
      type,
      caption,
      mediaUrl,
      status: 'sent',
      timestamp: new Date(),
    },
  });

  res.json({
    success: true,
    message: 'Media sent',
    data: {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      type,
      status: 'sent',
    },
  });
});

/**
 * @swagger
 * /api/messages/send-location:
 *   post:
 *     tags: [Messages]
 *     summary: Send location
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - to
 *               - latitude
 *               - longitude
 *             properties:
 *               sessionId:
 *                 type: string
 *               to:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Location sent
 */
const sendLocation = asyncHandler(async (req, res) => {
  const { sessionId, to, latitude, longitude, name, address } = req.body;

  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  const result = await whatsappService.sendLocation(session.name, to, latitude, longitude, {
    name,
    address,
  });

  await prisma.message.create({
    data: {
      sessionId: session.id,
      messageId: result.key.id,
      remoteJid: result.key.remoteJid,
      fromMe: true,
      type: 'location',
      content: JSON.stringify({ latitude, longitude, name, address }),
      status: 'sent',
      timestamp: new Date(),
    },
  });

  res.json({
    success: true,
    message: 'Location sent',
    data: {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      status: 'sent',
    },
  });
});

/**
 * @swagger
 * /api/messages/send-contact:
 *   post:
 *     tags: [Messages]
 *     summary: Send contact card
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - to
 *               - contact
 *             properties:
 *               sessionId:
 *                 type: string
 *               to:
 *                 type: string
 *               contact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *     responses:
 *       200:
 *         description: Contact sent
 */
const sendContact = asyncHandler(async (req, res) => {
  const { sessionId, to, contact } = req.body;

  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  const result = await whatsappService.sendContact(session.name, to, contact);

  await prisma.message.create({
    data: {
      sessionId: session.id,
      messageId: result.key.id,
      remoteJid: result.key.remoteJid,
      fromMe: true,
      type: 'contact',
      content: JSON.stringify(contact),
      status: 'sent',
      timestamp: new Date(),
    },
  });

  res.json({
    success: true,
    message: 'Contact sent',
    data: {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      status: 'sent',
    },
  });
});

/**
 * @swagger
 * /api/messages/send-buttons:
 *   post:
 *     tags: [Messages]
 *     summary: Send button message (may not work on all clients)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Buttons sent
 */
const sendButtons = asyncHandler(async (req, res) => {
  const { sessionId, to, text, buttons, footer } = req.body;

  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  const result = await whatsappService.sendButtons(session.name, to, text, buttons, { footer });

  res.json({
    success: true,
    message: 'Buttons sent',
    data: {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      status: 'sent',
    },
  });
});

/**
 * @swagger
 * /api/messages/{sessionId}:
 *   get:
 *     tags: [Messages]
 *     summary: Get message history
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: remoteJid
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Message history
 */
const getMessages = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { remoteJid, limit = 50, offset = 0 } = req.query;

  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  console.log('getMessages - session.id:', session.id, 'session.name:', session.name);

  const where = { sessionId: session.id };
  if (remoteJid) {
    where.remoteJid = remoteJid;
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.message.count({ where }),
  ]);

  res.json({
    success: true,
    data: messages,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
});

/**
 * @swagger
 * /api/messages/{sessionId}/read:
 *   post:
 *     tags: [Messages]
 *     summary: Mark messages as read
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keys
 *             properties:
 *               keys:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     remoteJid:
 *                       type: string
 *                     id:
 *                       type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 */
const readMessages = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { keys } = req.body;

  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  await whatsappService.readMessages(session.name, keys);

  res.json({
    success: true,
    message: 'Messages marked as read',
  });
});

/**
 * @swagger
 * /api/messages/{sessionId}/presence:
 *   post:
 *     tags: [Messages]
 *     summary: Set typing/recording presence
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Presence set
 */
const setPresence = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { jid, presence } = req.body; // composing, recording, paused

  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { name: sessionId },
      ],
      status: 'connected',
    },
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or not connected',
    });
  }

  await whatsappService.setPresence(session.name, jid, presence);

  res.json({
    success: true,
    message: 'Presence updated',
  });
});

// ==================== NEW MESSAGE FEATURES ====================

/**
 * @swagger
 * /api/messages/{sessionId}/forward:
 *   post:
 *     tags: [Messages]
 *     summary: Forward a message to another chat
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
 *               - to
 *               - messageKey
 *             properties:
 *               to:
 *                 type: string
 *                 description: Recipient phone number or JID
 *               messageKey:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   remoteJid:
 *                     type: string
 *                   fromMe:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Message forwarded
 */
const forwardMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { to, messageKey } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.forwardMessage(session.name, to, messageKey);
  res.json({ success: true, message: 'Message forwarded', data: { id: result.key.id } });
});

/**
 * @swagger
 * /api/messages/{sessionId}/send-seen:
 *   post:
 *     tags: [Messages]
 *     summary: Mark messages as read
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
 *               - jid
 *               - messageIds
 *             properties:
 *               jid:
 *                 type: string
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 */
const sendSeen = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { jid, messageIds } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.sendSeen(session.name, jid, messageIds);
  res.json({ success: true, message: 'Messages marked as read' });
});

/**
 * @swagger
 * /api/messages/{sessionId}/typing:
 *   post:
 *     tags: [Messages]
 *     summary: Send typing indicator
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
 *               - jid
 *             properties:
 *               jid:
 *                 type: string
 *                 description: Chat JID (phone@s.whatsapp.net or group@g.us)
 *                 example: "628123456789@s.whatsapp.net"
 *               action:
 *                 type: string
 *                 enum: [composing, paused, recording, available, unavailable]
 *                 default: composing
 *                 description: |
 *                   Presence action:
 *                   - `composing` - Show "typing..." indicator
 *                   - `paused` - Stop typing indicator
 *                   - `recording` - Show "recording audio..." indicator
 *                   - `available` - Show online status
 *                   - `unavailable` - Show offline status
 *     responses:
 *       200:
 *         description: Typing/presence indicator sent
 */
const sendTyping = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { jid, action = 'composing' } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.sendTyping(session.name, jid, action);
  
  const messages = {
    composing: 'Typing started',
    paused: 'Typing stopped',
    recording: 'Recording indicator shown',
    available: 'Online status set',
    unavailable: 'Offline status set',
  };
  
  res.json({ success: true, message: messages[action] || 'Presence updated' });
});

/**
 * @swagger
 * /api/messages/{sessionId}/reaction:
 *   post:
 *     tags: [Messages]
 *     summary: Send reaction to a message
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
 *               - messageKey
 *               - emoji
 *             properties:
 *               messageKey:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   remoteJid:
 *                     type: string
 *                   fromMe:
 *                     type: boolean
 *               emoji:
 *                 type: string
 *                 description: Emoji to react with (empty to remove)
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction sent
 */
const sendReaction = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { messageKey, emoji } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.sendReaction(session.name, messageKey, emoji);
  res.json({ success: true, message: emoji ? 'Reaction sent' : 'Reaction removed' });
});

/**
 * @swagger
 * /api/messages/{sessionId}/star:
 *   post:
 *     tags: [Messages]
 *     summary: Star or unstar a message
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
 *               - messageKey
 *             properties:
 *               messageKey:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   remoteJid:
 *                     type: string
 *                   fromMe:
 *                     type: boolean
 *               star:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Message starred/unstarred
 */
const starMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { messageKey, star = true } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.starMessage(session.name, messageKey, star);
  res.json({ success: true, message: star ? 'Message starred' : 'Message unstarred' });
});

/**
 * @swagger
 * /api/messages/{sessionId}/send-poll:
 *   post:
 *     tags: [Messages]
 *     summary: Send a poll
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
 *               - to
 *               - name
 *               - options
 *             properties:
 *               to:
 *                 type: string
 *               name:
 *                 type: string
 *                 description: Poll question
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 maxItems: 12
 *               selectableCount:
 *                 type: integer
 *                 default: 1
 *                 description: Number of options that can be selected
 *     responses:
 *       200:
 *         description: Poll sent
 */
const sendPoll = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { to, name, options, selectableCount = 1 } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.sendPoll(session.name, to, name, options, { selectableCount });
  res.json({ success: true, message: 'Poll sent', data: { id: result.key.id } });
});

/**
 * @swagger
 * /api/messages/{sessionId}/poll-vote:
 *   post:
 *     tags: [Messages]
 *     summary: Vote on a poll
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
 *               - pollMessageKey
 *               - selectedOptions
 *             properties:
 *               pollMessageKey:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   remoteJid:
 *                     type: string
 *                   fromMe:
 *                     type: boolean
 *               selectedOptions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of option texts to vote for
 *     responses:
 *       200:
 *         description: Vote submitted
 */
const sendPollVote = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { pollMessageKey, selectedOptions } = req.body;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  await whatsappService.sendPollVote(session.name, pollMessageKey, selectedOptions);
  res.json({ success: true, message: 'Vote submitted' });
});

module.exports = {
  sendText,
  sendMedia,
  sendLocation,
  sendContact,
  sendButtons,
  getMessages,
  readMessages,
  setPresence,
  forwardMessage,
  sendSeen,
  sendTyping,
  sendReaction,
  starMessage,
  sendPoll,
  sendPollVote,
};

