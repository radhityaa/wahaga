const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: WhatsApp Event Messages (calendar invites)
 */

// Send event message
router.post('/:sessionId', eventController.sendEventMessage);

module.exports = router;
