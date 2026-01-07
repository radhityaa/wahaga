const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const { apiKeyAuth } = require('../middlewares/auth.middleware');
const { validate, sessionSchemas } = require('../middlewares/validation.middleware');

// Apply API key auth to all routes
router.use(apiKeyAuth);

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: List all sessions
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 */
router.get('/', sessionController.listSessions);

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     tags: [Sessions]
 *     summary: Create new session
 *     security:
 *       - ApiKeyAuth: []
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
 *                 description: Unique session name (alphanumeric, underscore, hyphen only)
 *                 example: my-session
 *     responses:
 *       201:
 *         description: Session created
 */
router.post('/', validate(sessionSchemas.create), sessionController.createSession);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     tags: [Sessions]
 *     summary: Get session details
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *         example: my-session
 *     responses:
 *       200:
 *         description: Session details
 */
router.get('/:sessionId', sessionController.getSession);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     tags: [Sessions]
 *     summary: Delete session
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *     responses:
 *       200:
 *         description: Session deleted
 */
router.delete('/:sessionId', sessionController.deleteSession);

/**
 * @swagger
 * /api/sessions/{sessionId}/qr:
 *   get:
 *     tags: [Sessions]
 *     summary: Get QR code for session
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *         example: my-session
 *     responses:
 *       200:
 *         description: QR code data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     qrBase64:
 *                       type: string
 *                       description: Base64 encoded QR code image
 */
router.get('/:sessionId/qr', sessionController.getQR);

/**
 * @swagger
 * /api/sessions/{sessionId}/status:
 *   get:
 *     tags: [Sessions]
 *     summary: Get session status
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *     responses:
 *       200:
 *         description: Session status
 */
router.get('/:sessionId/status', sessionController.getStatus);

/**
 * @swagger
 * /api/sessions/{sessionId}/restart:
 *   post:
 *     tags: [Sessions]
 *     summary: Restart session
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *     responses:
 *       200:
 *         description: Session restarted
 */
router.post('/:sessionId/restart', sessionController.restartSession);

/**
 * @swagger
 * /api/sessions/{sessionId}/stop:
 *   post:
 *     tags: [Sessions]
 *     summary: Stop session (disconnect without logout)
 *     description: |
 *       Stops the WhatsApp connection but keeps auth credentials intact.
 *       Session can be reconnected later without scanning QR code again using the restart endpoint.
 *       
 *       **Difference from logout:**
 *       - Stop: Disconnects but keeps credentials (status: "stopped")
 *       - Logout: Logs out from WhatsApp and clears credentials (status: "disconnected")
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *         example: my-session
 *     responses:
 *       200:
 *         description: Session stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Session stopped (can be reconnected without QR scan)"
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:sessionId/stop', sessionController.stopSession);

/**
 * @swagger
 * /api/sessions/{sessionId}/pair:
 *   post:
 *     tags: [Sessions]
 *     summary: Request pairing code
 *     description: Request a pairing code to link WhatsApp without scanning QR code
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number with country code
 *                 example: "628123456789"
 *     responses:
 *       200:
 *         description: Pairing code generated
 */
router.post('/:sessionId/pair', sessionController.requestPairingCode);

/**
 * @swagger
 * /api/sessions/{sessionId}/logout:
 *   post:
 *     tags: [Sessions]
 *     summary: Logout session (complete logout from WhatsApp)
 *     description: |
 *       Logs out the session from WhatsApp completely. The linked device will be removed from WhatsApp.
 *       Session record is kept in database but auth credentials are cleared.
 *       To reconnect, you will need to scan a new QR code or use pairing code.
 *       
 *       **Difference from stop:**
 *       - Logout: Logs out from WhatsApp and clears credentials (status: "disconnected")
 *       - Stop: Disconnects but keeps credentials (status: "stopped")
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *         example: my-session
 *     responses:
 *       200:
 *         description: Session logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Session logged out"
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:sessionId/logout', sessionController.logoutSession);

/**
 * @swagger
 * /api/sessions/{sessionId}/check-number:
 *   get:
 *     tags: [Sessions]
 *     summary: Check if number is registered on WhatsApp
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number to check (e.g., 628123456789)
 *         example: "628123456789"
 *     responses:
 *       200:
 *         description: Check result
 */
router.get('/:sessionId/check-number', sessionController.checkNumber);

/**
 * @swagger
 * /api/sessions/{sessionId}/me:
 *   get:
 *     tags: [Sessions]
 *     summary: Get WhatsApp account info for session
 *     description: Get information about the associated WhatsApp account for that session
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session name or ID
 *     responses:
 *       200:
 *         description: Account information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     pushName:
 *                       type: string
 *                     profilePicture:
 *                       type: string
 *                     isConnected:
 *                       type: boolean
 */
router.get('/:sessionId/me', sessionController.getMe);

// ==================== PROFILE ROUTES ====================

/**
 * @swagger
 * /api/sessions/{sessionId}/profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get my WhatsApp profile
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
 *         description: Profile information
 */
router.get('/:sessionId/profile', sessionController.getProfile);

/**
 * @swagger
 * /api/sessions/{sessionId}/profile/name:
 *   put:
 *     tags: [Profile]
 *     summary: Update profile name (push name)
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
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: Profile name updated
 */
router.put('/:sessionId/profile/name', sessionController.updateProfileName);

/**
 * @swagger
 * /api/sessions/{sessionId}/profile/status:
 *   put:
 *     tags: [Profile]
 *     summary: Update profile status (about)
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: Available
 *     responses:
 *       200:
 *         description: Profile status updated
 */
router.put('/:sessionId/profile/status', sessionController.updateProfileStatus);

/**
 * @swagger
 * /api/sessions/{sessionId}/profile/picture:
 *   put:
 *     tags: [Profile]
 *     summary: Update profile picture
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
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 description: Base64 encoded image (with or without data URL prefix)
 *     responses:
 *       200:
 *         description: Profile picture updated
 */
router.put('/:sessionId/profile/picture', sessionController.updateProfilePicture);

/**
 * @swagger
 * /api/sessions/{sessionId}/profile/picture:
 *   delete:
 *     tags: [Profile]
 *     summary: Delete profile picture
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
 *         description: Profile picture deleted
 */
router.delete('/:sessionId/profile/picture', sessionController.deleteProfilePicture);

module.exports = router;

