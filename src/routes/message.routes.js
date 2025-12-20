const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { apiKeyAuth } = require('../middlewares/auth.middleware');
const { validate, messageSchemas } = require('../middlewares/validation.middleware');
const { messageLimiter } = require('../middlewares/rateLimit.middleware');

// Apply API key auth to all routes
router.use(apiKeyAuth);

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
 *             type: object
 *             required:
 *               - sessionId
 *               - to
 *               - text
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session name
 *                 example: my-session
 *               to:
 *                 type: string
 *                 description: Recipient phone number
 *                 example: "628123456789"
 *               text:
 *                 type: string
 *                 description: Message text
 *                 example: Hello World!
 *     responses:
 *       200:
 *         description: Message sent
 */
router.post(
  '/send',
  messageLimiter,
  validate(messageSchemas.sendText),
  messageController.sendText
);

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
 *             type: object
 *             required:
 *               - sessionId
 *               - to
 *               - type
 *               - mediaUrl
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: my-session
 *               to:
 *                 type: string
 *                 example: "628123456789"
 *               type:
 *                 type: string
 *                 enum: [image, video, audio, document]
 *                 example: image
 *               mediaUrl:
 *                 type: string
 *                 description: URL to media file
 *                 example: https://example.com/image.jpg
 *               caption:
 *                 type: string
 *                 example: Check this out!
 *     responses:
 *       200:
 *         description: Media sent
 */
router.post(
  '/send-media',
  messageLimiter,
  validate(messageSchemas.sendMedia),
  messageController.sendMedia
);

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
 *                 example: my-session
 *               to:
 *                 type: string
 *                 example: "628123456789"
 *               latitude:
 *                 type: number
 *                 example: -6.2088
 *               longitude:
 *                 type: number
 *                 example: 106.8456
 *               name:
 *                 type: string
 *                 example: Monas
 *               address:
 *                 type: string
 *                 example: Jakarta Pusat
 *     responses:
 *       200:
 *         description: Location sent
 */
router.post(
  '/send-location',
  messageLimiter,
  validate(messageSchemas.sendLocation),
  messageController.sendLocation
);

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
 *                 example: my-session
 *               to:
 *                 type: string
 *                 example: "628123456789"
 *               contact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: John Doe
 *                   phone:
 *                     type: string
 *                     example: "628123456789"
 *     responses:
 *       200:
 *         description: Contact sent
 */
router.post(
  '/send-contact',
  messageLimiter,
  validate(messageSchemas.sendContact),
  messageController.sendContact
);

/**
 * @swagger
 * /api/messages/send-buttons:
 *   post:
 *     tags: [Messages]
 *     summary: Send button message (deprecated by WhatsApp)
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
 *               - text
 *               - buttons
 *             properties:
 *               sessionId:
 *                 type: string
 *               to:
 *                 type: string
 *               text:
 *                 type: string
 *               buttons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     text:
 *                       type: string
 *               footer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Buttons sent
 */
router.post(
  '/send-buttons',
  messageLimiter,
  validate(messageSchemas.sendButtons),
  messageController.sendButtons
);

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
 *         description: Session name
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: remoteJid
 *         schema:
 *           type: string
 *         description: Filter by chat JID
 *     responses:
 *       200:
 *         description: Message list
 */
router.get('/:sessionId', messageController.getMessages);

/**
 * @swagger
 * /api/messages/{sessionId}/read:
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
 *             properties:
 *               keys:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Messages marked as read
 */
router.post('/:sessionId/read', messageController.readMessages);

// ==================== NEW MESSAGE ROUTES ====================

/**
 * @swagger
 * /api/messages/{sessionId}/forward:
 *   post:
 *     tags: [Messages]
 *     summary: Forward a message
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
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
 *               messageKey:
 *                 type: object
 *     responses:
 *       200:
 *         description: Message forwarded
 */
router.post('/:sessionId/forward', messageController.forwardMessage);

/**
 * @swagger
 * /api/messages/{sessionId}/send-seen:
 *   post:
 *     tags: [Messages]
 *     summary: Mark messages as read (send seen)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
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
router.post('/:sessionId/send-seen', messageController.sendSeen);

/**
 * @swagger
 * /api/messages/{sessionId}/typing:
 *   post:
 *     tags: [Messages]
 *     summary: Send typing/presence indicator
 *     description: "Send presence status to a chat. Available actions: composing (typing...), paused (stop), recording (voice note), available (online), unavailable (offline)"
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
 *                 description: Chat JID
 *                 example: "628123456789@s.whatsapp.net"
 *               action:
 *                 type: string
 *                 enum: [composing, paused, recording, available, unavailable]
 *                 default: composing
 *                 description: "composing=typing, paused=stop, recording=voice, available=online, unavailable=offline"
 *     responses:
 *       200:
 *         description: Presence indicator sent
 */
router.post('/:sessionId/typing', messageController.sendTyping);

/**
 * @swagger
 * /api/messages/{sessionId}/reaction:
 *   post:
 *     tags: [Messages]
 *     summary: React to a message
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
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
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction sent
 */
router.post('/:sessionId/reaction', messageController.sendReaction);

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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageKey
 *             properties:
 *               messageKey:
 *                 type: object
 *               star:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Message starred/unstarred
 */
router.post('/:sessionId/star', messageController.starMessage);

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
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               selectableCount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Poll sent
 */
router.post('/:sessionId/send-poll', messageController.sendPoll);

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
 *               selectedOptions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Vote submitted
 */
router.post('/:sessionId/poll-vote', messageController.sendPollVote);

module.exports = router;

