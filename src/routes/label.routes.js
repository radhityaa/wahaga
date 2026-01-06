const express = require('express');
const router = express.Router();
const labelController = require('../controllers/label.controller');

/**
 * @swagger
 * tags:
 *   name: Labels
 *   description: WhatsApp Labels (Business accounts only)
 */

// Get all labels
router.get('/:sessionId', labelController.getLabels);

// Create a label
router.post('/:sessionId', labelController.createLabel);

// Update a label
router.put('/:sessionId/:labelId', labelController.updateLabel);

// Delete a label
router.delete('/:sessionId/:labelId', labelController.deleteLabel);

// Get labels for a chat
router.get('/:sessionId/chats/:chatId', labelController.getLabelsForChat);

// Set labels for a chat
router.put('/:sessionId/chats/:chatId', labelController.setLabelsForChat);

// Get chats by label
router.get('/:sessionId/:labelId/chats', labelController.getChatsByLabel);

module.exports = router;
