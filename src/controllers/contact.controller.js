const asyncHandler = require('express-async-handler');
const prisma = require('../config/prisma');
const whatsappService = require('../services/whatsapp.service');

// Helper function to get session
const getSession = async (sessionId) => {
  return prisma.session.findFirst({
    where: { OR: [{ id: sessionId }, { name: sessionId }], status: 'connected' },
  });
};

/**
 * @swagger
 * /api/contacts/{sessionId}:
 *   get:
 *     tags: [Contacts]
 *     summary: Get all contacts
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
 *         description: List of contacts
 */
const getContacts = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const contacts = await whatsappService.getContacts(session.name);
  res.json({ success: true, data: contacts });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}:
 *   get:
 *     tags: [Contacts]
 *     summary: Get contact info
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact info
 */
const getContact = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const contact = await whatsappService.getContactInfo(session.name, phone);
  res.json({ success: true, data: contact });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/check/{phone}:
 *   get:
 *     tags: [Contacts]
 *     summary: Check if phone is on WhatsApp
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check result
 */
const checkPhone = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const result = await whatsappService.checkIsOnWhatsApp(session.name, phone);
  res.json({ success: true, data: result });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}/about:
 *   get:
 *     tags: [Contacts]
 *     summary: Get contact about/status
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: About info
 */
const getAbout = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const result = await whatsappService.getContactAbout(session.name, phone);
  res.json({ success: true, data: result });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}/picture:
 *   get:
 *     tags: [Contacts]
 *     summary: Get contact profile picture
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile picture URL
 */
const getPicture = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const result = await whatsappService.getContactProfilePicture(session.name, phone);
  res.json({ success: true, data: result });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}/block:
 *   post:
 *     tags: [Contacts]
 *     summary: Block a contact
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact blocked
 */
const blockContact = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await whatsappService.blockContact(session.name, phone);
  res.json({ success: true, message: 'Contact blocked' });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}/unblock:
 *   post:
 *     tags: [Contacts]
 *     summary: Unblock a contact
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact unblocked
 */
const unblockContact = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await whatsappService.unblockContact(session.name, phone);
  res.json({ success: true, message: 'Contact unblocked' });
});

// ==================== LID ENDPOINTS ====================

/**
 * @swagger
 * /api/contacts/{sessionId}/lids:
 *   get:
 *     tags: [Contacts]
 *     summary: Get all LID mappings
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
 *         description: LID mappings
 */
const getLidMappings = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const result = await whatsappService.getLidMappings(session.name);
  res.json({ success: true, data: result });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/lids/count:
 *   get:
 *     tags: [Contacts]
 *     summary: Get LID count
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
 *         description: LID count
 */
const getLidCount = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const count = await whatsappService.getLidCount(session.name);
  res.json({ success: true, data: { count } });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/lids/{lid}/phone:
 *   get:
 *     tags: [Contacts]
 *     summary: Get phone by LID
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Phone number
 */
const getPhoneByLid = asyncHandler(async (req, res) => {
  const { sessionId, lid } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const phone = await whatsappService.getPhoneByLid(session.name, lid);
  res.json({ success: true, data: { lid, phone } });
});

/**
 * @swagger
 * /api/contacts/{sessionId}/phone/{phone}/lid:
 *   get:
 *     tags: [Contacts]
 *     summary: Get LID by phone
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: LID
 */
const getLidByPhone = asyncHandler(async (req, res) => {
  const { sessionId, phone } = req.params;
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const lid = await whatsappService.getLidByPhone(session.name, phone);
  res.json({ success: true, data: { phone, lid } });
});

module.exports = {
  getContacts,
  getContact,
  checkPhone,
  getAbout,
  getPicture,
  blockContact,
  unblockContact,
  getLidMappings,
  getLidCount,
  getPhoneByLid,
  getLidByPhone,
};
