const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channel.controller');

/**
 * @swagger
 * tags:
 *   name: Channels
 *   description: WhatsApp Channels/Newsletter management
 */

// Get list of channels
router.get('/:sessionId', channelController.getChannels);

// Create a new channel
router.post('/:sessionId', channelController.createChannel);

// Delete a channel
router.delete('/:sessionId/:channelId', channelController.deleteChannel);

// Get channel info
router.get('/:sessionId/:channelId/info', channelController.getChannelInfo);

// Get channel messages (preview)
router.get('/:sessionId/:channelId/messages', channelController.getChannelMessages);

// Follow a channel
router.post('/:sessionId/:channelId/follow', channelController.followChannel);

// Unfollow a channel
router.post('/:sessionId/:channelId/unfollow', channelController.unfollowChannel);

// Mute a channel
router.post('/:sessionId/:channelId/mute', channelController.muteChannel);

// Unmute a channel
router.post('/:sessionId/:channelId/unmute', channelController.unmuteChannel);

module.exports = router;
