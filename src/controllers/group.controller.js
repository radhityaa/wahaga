const whatsappService = require('../services/whatsapp.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const { formatJid } = require('../utils/helpers');
const prisma = require('../config/prisma');

/**
 * @swagger
 * /api/groups/{sessionId}:
 *   get:
 *     tags: [Groups]
 *     summary: List all groups
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
 *         description: List of groups
 */
const listGroups = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

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

  const groups = await whatsappService.getChats(session.name);

  res.json({
    success: true,
    data: groups.map((g) => ({
      id: g.id,
      subject: g.subject,
      owner: g.owner,
      creation: g.creation,
      participants: g.participants?.length || 0,
    })),
  });
});

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}:
 *   get:
 *     tags: [Groups]
 *     summary: Get group metadata
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Group metadata
 */
const getGroup = asyncHandler(async (req, res) => {
  const { sessionId, groupId } = req.params;

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

  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  const metadata = await whatsappService.getGroupMetadata(session.name, jid);

  res.json({
    success: true,
    data: metadata,
  });
});

/**
 * @swagger
 * /api/groups/create:
 *   post:
 *     tags: [Groups]
 *     summary: Create new group
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
 *               - name
 *               - participants
 *             properties:
 *               sessionId:
 *                 type: string
 *               name:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Group created
 */
const createGroup = asyncHandler(async (req, res) => {
  const { sessionId, name, participants } = req.body;

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

  const result = await whatsappService.createGroup(session.name, name, participants);

  res.status(201).json({
    success: true,
    message: 'Group created',
    data: result,
  });
});

/**
 * @swagger
 * /api/groups/{groupId}/add:
 *   post:
 *     tags: [Groups]
 *     summary: Add participants to group
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Participants added
 */
const addParticipants = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { sessionId, participants } = req.body;

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

  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  const result = await whatsappService.addParticipants(session.name, jid, participants);

  res.json({
    success: true,
    message: 'Participants added',
    data: result,
  });
});

/**
 * @swagger
 * /api/groups/{groupId}/remove:
 *   post:
 *     tags: [Groups]
 *     summary: Remove participants from group
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Participants removed
 */
const removeParticipants = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { sessionId, participants } = req.body;

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

  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  const result = await whatsappService.removeParticipants(session.name, jid, participants);

  res.json({
    success: true,
    message: 'Participants removed',
    data: result,
  });
});

/**
 * @swagger
 * /api/groups/{groupId}/leave:
 *   post:
 *     tags: [Groups]
 *     summary: Leave group
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Left group
 */
const leaveGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { sessionId } = req.body;

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

  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  await whatsappService.leaveGroup(session.name, jid);

  res.json({
    success: true,
    message: 'Left group',
  });
});

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/invite-code:
 *   get:
 *     tags: [Groups]
 *     summary: Get group invite code
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invite code
 */
const getInviteCode = asyncHandler(async (req, res) => {
  const { sessionId, groupId } = req.params;

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

  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  const code = await whatsappService.getInviteCode(session.name, jid);

  res.json({
    success: true,
    data: {
      code,
      link: `https://chat.whatsapp.com/${code}`,
    },
  });
});

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/picture:
 *   get:
 *     tags: [Groups]
 *     summary: Get group profile picture (downloads and saves to server)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile picture URL from server
 */
const getProfilePicture = asyncHandler(async (req, res) => {
  const { sessionId, groupId } = req.params;

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

  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  const result = await whatsappService.downloadProfilePicture(session.name, jid);

  if (result.error) {
    return res.status(400).json({
      success: false,
      message: result.error,
    });
  }

  if (!result.localPath) {
    return res.json({
      success: true,
      data: { url: null, message: 'No profile picture available' },
    });
  }

  res.json({
    success: true,
    data: {
      url: result.localPath,
      filename: result.filename,
      size: result.size,
    },
  });
});

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  addParticipants,
  removeParticipants,
  leaveGroup,
  getInviteCode,
  getProfilePicture,
};
