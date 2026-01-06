const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const { apiKeyAuth } = require('../middlewares/auth.middleware');
const { validate, groupSchemas } = require('../middlewares/validation.middleware');

// Apply API key auth to all routes
router.use(apiKeyAuth);

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
 *         description: Session name
 *         example: my-session
 *     responses:
 *       200:
 *         description: List of groups
 */
router.get('/:sessionId', groupController.listGroups);

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}:
 *   get:
 *     tags: [Groups]
 *     summary: Get group details
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group JID (e.g., 123456789@g.us)
 *     responses:
 *       200:
 *         description: Group details
 */
router.get('/:sessionId/:groupId', groupController.getGroup);

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
 *                 example: my-session
 *               name:
 *                 type: string
 *                 example: My Group
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["628123456789", "628987654321"]
 *     responses:
 *       201:
 *         description: Group created
 */
router.post('/create', validate(groupSchemas.create), groupController.createGroup);

/**
 * @swagger
 * /api/groups/{groupId}/add:
 *   post:
 *     tags: [Groups]
 *     summary: Add participants to group
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group JID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - participants
 *             properties:
 *               sessionId:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participants added
 */
router.post('/:groupId/add', validate(groupSchemas.updateParticipants), groupController.addParticipants);

/**
 * @swagger
 * /api/groups/{groupId}/remove:
 *   post:
 *     tags: [Groups]
 *     summary: Remove participants from group
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
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
 *               - sessionId
 *               - participants
 *             properties:
 *               sessionId:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participants removed
 */
router.post('/:groupId/remove', validate(groupSchemas.updateParticipants), groupController.removeParticipants);

/**
 * @swagger
 * /api/groups/{groupId}/leave:
 *   post:
 *     tags: [Groups]
 *     summary: Leave group
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
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
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Left group
 */
router.post('/:groupId/leave', groupController.leaveGroup);

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
router.get('/:sessionId/:groupId/invite-code', groupController.getInviteCode);

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
router.get('/:sessionId/:groupId/picture', groupController.getProfilePicture);

module.exports = router;


