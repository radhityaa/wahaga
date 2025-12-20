const express = require('express');
const router = express.Router();
const presenceController = require('../controllers/presence.controller');

/**
 * @swagger
 * tags:
 *   name: Presence
 *   description: WhatsApp Presence (online/offline/typing status)
 */

// Set presence (POST body: { presence, chatId? })
router.post('/:sessionId', presenceController.setPresence);

// Get all subscribed presences
router.get('/:sessionId', presenceController.getAllPresences);

// Get presence for specific chat (auto-subscribes)
router.get('/:sessionId/:chatId', presenceController.getPresence);

// Subscribe to presence updates
router.post('/:sessionId/:chatId/subscribe', presenceController.subscribePresence);

module.exports = router;
