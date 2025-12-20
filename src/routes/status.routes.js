const express = require('express');
const router = express.Router();
const statusController = require('../controllers/status.controller');

/**
 * @swagger
 * tags:
 *   name: Status
 *   description: WhatsApp Status/Stories management
 */

// Generate new message ID for batch sending
router.get('/:sessionId/new-message-id', statusController.generateMessageId);

// Send text status
router.post('/:sessionId/text', statusController.sendTextStatus);

// Send image status
router.post('/:sessionId/image', statusController.sendImageStatus);

// Send video status
router.post('/:sessionId/video', statusController.sendVideoStatus);

// Send voice status
router.post('/:sessionId/voice', statusController.sendVoiceStatus);

// Delete status
router.post('/:sessionId/delete', statusController.deleteStatus);

module.exports = router;
