const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { apiKeyAuth } = require('../middlewares/auth.middleware');

// Apply API key auth to all routes
router.use(apiKeyAuth);

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
router.get('/:sessionId', contactController.getContacts);

/**
 * @swagger
 * /api/contacts/{sessionId}/lids:
 *   get:
 *     tags: [Contacts]
 *     summary: Get all LID to phone mappings
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
router.get('/:sessionId/lids', contactController.getLidMappings);

/**
 * @swagger
 * /api/contacts/{sessionId}/lids/count:
 *   get:
 *     tags: [Contacts]
 *     summary: Get number of known LIDs
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
router.get('/:sessionId/lids/count', contactController.getLidCount);

/**
 * @swagger
 * /api/contacts/{sessionId}/lids/{lid}/phone:
 *   get:
 *     tags: [Contacts]
 *     summary: Get phone number by LID
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
router.get('/:sessionId/lids/:lid/phone', contactController.getPhoneByLid);

/**
 * @swagger
 * /api/contacts/{sessionId}/check/{phone}:
 *   get:
 *     tags: [Contacts]
 *     summary: Check if phone is registered on WhatsApp
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
router.get('/:sessionId/check/:phone', contactController.checkPhone);

/**
 * @swagger
 * /api/contacts/{sessionId}/phone/{phone}/lid:
 *   get:
 *     tags: [Contacts]
 *     summary: Get LID by phone number
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
router.get('/:sessionId/phone/:phone/lid', contactController.getLidByPhone);

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}:
 *   get:
 *     tags: [Contacts]
 *     summary: Get contact basic info
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
router.get('/:sessionId/:phone', contactController.getContact);

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
router.get('/:sessionId/:phone/about', contactController.getAbout);

/**
 * @swagger
 * /api/contacts/{sessionId}/{phone}/picture:
 *   get:
 *     tags: [Contacts]
 *     summary: Get contact profile picture URL
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
router.get('/:sessionId/:phone/picture', contactController.getPicture);

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
router.post('/:sessionId/:phone/block', contactController.blockContact);

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
router.post('/:sessionId/:phone/unblock', contactController.unblockContact);

module.exports = router;
