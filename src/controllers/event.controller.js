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
 * /api/events/{sessionId}:
 *   post:
 *     tags: [Events]
 *     summary: Send an event message (calendar invite)
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
 *               - chatId
 *               - event
 *             properties:
 *               chatId:
 *                 type: string
 *                 description: Recipient JID
 *                 example: "628123456789@s.whatsapp.net"
 *               reply_to:
 *                 type: string
 *                 description: Message ID to reply to (optional)
 *               event:
 *                 type: object
 *                 required:
 *                   - name
 *                   - startTime
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Event title
 *                     example: "Meeting with Team"
 *                   description:
 *                     type: string
 *                     description: Event description (supports *bold* and newlines)
 *                   startTime:
 *                     type: integer
 *                     description: Start time (Unix timestamp in seconds)
 *                     example: 1734700800
 *                   endTime:
 *                     type: integer
 *                     description: End time (Unix timestamp in seconds, optional)
 *                   location:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "Conference Room A"
 *                   extraGuestsAllowed:
 *                     type: boolean
 *                     default: false
 *                   callType:
 *                     type: integer
 *                     description: "0=none, 1=voice, 2=video"
 *                     default: 0
 *                   joinLink:
 *                     type: string
 *                     description: Call/meeting join link
 *     responses:
 *       200:
 *         description: Event message sent
 */
const sendEventMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { chatId, event, reply_to } = req.body;

  if (!chatId) {
    return res.status(400).json({ success: false, message: 'chatId is required' });
  }
  if (!event || !event.name || !event.startTime) {
    return res.status(400).json({ success: false, message: 'event.name and event.startTime are required' });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const result = await whatsappService.sendEventMessage(session.name, chatId, event, {
    replyTo: reply_to,
  });

  res.json({ success: true, message: 'Event message sent', data: result });
});

module.exports = {
  sendEventMessage,
};
