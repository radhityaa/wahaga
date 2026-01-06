const whatsappService = require('../services/whatsapp.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const prisma = require('../config/prisma');

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
 */
const listSessions = asyncHandler(async (req, res) => {
  // Get sessions from database
  const dbSessions = await prisma.session.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      phone: true,
      pushName: true,
      lastSeen: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Merge with live state
  const sessions = dbSessions.map((session) => {
    const liveState = whatsappService.getState(session.name);
    return {
      ...session,
      liveStatus: liveState.status,
      isConnected: liveState.status === 'connected',
    };
  });

  res.json({
    success: true,
    data: sessions,
  });
});

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     tags: [Sessions]
 *     summary: Create new session
 *     description: Creates a new session in database. Use /qr or /pair endpoint to start connection.
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
 *         description: Session created. Use /qr or /pair to connect.
 */
const createSession = asyncHandler(async (req, res) => {
  const { name } = req.body;

  // Check if session already exists
  const existing = await prisma.session.findUnique({
    where: { name },
  });

  if (existing) {
    const state = whatsappService.getState(name);
    return res.json({
      success: true,
      message: 'Session already exists',
      data: { 
        id: existing.id,
        name, 
        status: state.status || existing.status,
        isConnected: state.status === 'connected',
      },
    });
  }

  // Only create in database - don't start WhatsApp connection yet
  const session = await prisma.session.create({
    data: {
      name,
      status: 'created',
    },
  });

  res.status(201).json({
    success: true,
    message: 'Session created. Use GET /qr or POST /pair to connect.',
    data: {
      id: session.id,
      name: session.name,
      status: 'created',
      nextSteps: {
        qr: `/api/sessions/${name}/qr`,
        pair: `/api/sessions/${name}/pair`,
      },
    },
  });
});

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
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 */
const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

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

  const liveState = whatsappService.getState(session.name);

  res.json({
    success: true,
    data: {
      ...session,
      liveStatus: liveState.status,
      isConnected: liveState.status === 'connected',
    },
  });
});

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
 *     responses:
 *       200:
 *         description: Session deleted
 */
const deleteSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { logout = true } = req.query;

  // Find session
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

  await whatsappService.deleteSession(session.name, logout === 'true' || logout === true);

  res.json({
    success: true,
    message: 'Session deleted successfully',
  });
});

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
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [base64, image]
 *     responses:
 *       200:
 *         description: QR code
 */
const getQR = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { format = 'base64' } = req.query;

  // Find session
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

  // Check if already connected
  let state = whatsappService.getState(session.name);
  if (state.status === 'connected') {
    return res.json({
      success: true,
      message: 'Session already connected',
      data: { status: 'connected', qr: null },
    });
  }

  // Start WhatsApp connection if not already started
  if (!state.status || state.status === 'created' || state.status === 'disconnected') {
    await whatsappService.createSession(session.name);
    // Wait a moment for QR to be generated
    await new Promise(resolve => setTimeout(resolve, 2000));
    state = whatsappService.getState(session.name);
  }

  const qr = whatsappService.getQR(session.name);

  if (!qr) {
    return res.status(202).json({
      success: true,
      message: 'QR code is being generated. Please retry in a few seconds.',
      data: { status: state.status },
    });
  }

  if (format === 'image') {
    // Return as image
    const base64Data = qr.qrBase64.replace(/^data:image\/png;base64,/, '');
    const img = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length,
    });
    return res.end(img);
  }

  res.json({
    success: true,
    data: {
      qr: qr.qr,
      qrBase64: qr.qrBase64,
    },
  });
});

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
 *     responses:
 *       200:
 *         description: Session status
 */
const getStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

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

  const state = whatsappService.getState(session.name);

  res.json({
    success: true,
    data: {
      name: session.name,
      status: state.status,
      phone: state.phone || session.phone,
      pushName: state.pushName || session.pushName,
      isConnected: state.status === 'connected',
    },
  });
});

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
 *     responses:
 *       200:
 *         description: Session restarted
 */
const restartSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

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

  await whatsappService.restartSession(session.name);

  res.json({
    success: true,
    message: 'Session restart initiated',
  });
});

/**
 * @swagger
 * /api/sessions/{sessionId}/pair:
 *   post:
 *     tags: [Sessions]
 *     summary: Request pairing code (alternative to QR scan)
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
 *         description: Pairing code
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
 *                     code:
 *                       type: string
 *                       description: 8-digit pairing code
 *                       example: "1234-5678"
 */
const requestPairingCode = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required (E.164 format without +, e.g., 628123456789)',
    });
  }

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
      message: 'Session not found. Create session first using POST /api/sessions',
    });
  }

  // Service handles connection startup and pairing code request
  const result = await whatsappService.requestPairingCode(session.name, phoneNumber);

  res.json({
    success: true,
    message: 'Pairing code generated. Enter this code in your WhatsApp app.',
    data: {
      code: result.code,
      instructions: 'Open WhatsApp > Settings > Linked Devices > Link a Device > Link with phone number instead',
    },
  });
});

/**
 * @swagger
 * /api/sessions/{sessionId}/logout:
 *   post:
 *     tags: [Sessions]
 *     summary: Logout session (keeps session in database)
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
 *         description: Session logged out
 */
const logoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

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

  const socket = whatsappService.getSession(session.name);
  if (socket) {
    await socket.logout();
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'disconnected', qrCode: null },
  });

  res.json({
    success: true,
    message: 'Session logged out',
  });
});

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
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Number check result
 */
const checkNumber = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required',
    });
  }

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

  const result = await whatsappService.isRegistered(session.name, phone);

  res.json({
    success: true,
    data: result,
  });
});

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
 *       404:
 *         description: Session not found or not connected
 */
const getMe = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

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

  const state = whatsappService.getState(session.name);
  
  if (state.status !== 'connected') {
    return res.status(400).json({
      success: false,
      message: 'Session not connected',
      data: { status: state.status },
    });
  }

  // Get profile picture
  let profilePicture = null;
  try {
    const phone = state.phone || session.phone;
    if (phone) {
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      const picResult = await whatsappService.downloadProfilePicture(session.name, jid);
      if (picResult.localPath) {
        profilePicture = picResult.localPath;
      }
    }
  } catch (e) {
    // Ignore profile picture errors
  }

  res.json({
    success: true,
    data: {
      id: session.id,
      name: session.name,
      status: state.status,
      phone: state.phone || session.phone,
      pushName: state.pushName || session.pushName,
      profilePicture,
      isConnected: true,
      lastSeen: session.lastSeen,
      createdAt: session.createdAt,
    },
  });
});

module.exports = {
  listSessions,
  createSession,
  getSession,
  deleteSession,
  getQR,
  getStatus,
  restartSession,
  requestPairingCode,
  logoutSession,
  checkNumber,
  getMe,
};

// ==================== PROFILE CONTROLLERS ====================

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
const getProfile = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }] },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const profile = await whatsappService.getMyProfile(session.name);
  res.json({ success: true, data: profile });
});

/**
 * @swagger
 * /api/sessions/{sessionId}/profile/name:
 *   put:
 *     tags: [Profile]
 *     summary: Update profile name
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
const updateProfileName = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required' });
  }
  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }] },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await whatsappService.setProfileName(session.name, name);
  res.json({ success: true, message: 'Profile name updated' });
});

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
const updateProfileStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }
  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }] },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await whatsappService.setProfileStatus(session.name, status);
  res.json({ success: true, message: 'Profile status updated' });
});

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
 *                 description: Base64 encoded image
 *     responses:
 *       200:
 *         description: Profile picture updated
 */
const updateProfilePicture = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ success: false, message: 'Image (base64) is required' });
  }
  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }] },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await whatsappService.setProfilePicture(session.name, image);
  res.json({ success: true, message: 'Profile picture updated' });
});

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
const deleteProfilePicture = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }] },
  });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await whatsappService.deleteProfilePicture(session.name);
  res.json({ success: true, message: 'Profile picture deleted' });
});

// Add profile exports
module.exports.getProfile = getProfile;
module.exports.updateProfileName = updateProfileName;
module.exports.updateProfileStatus = updateProfileStatus;
module.exports.updateProfilePicture = updateProfilePicture;
module.exports.deleteProfilePicture = deleteProfilePicture;

