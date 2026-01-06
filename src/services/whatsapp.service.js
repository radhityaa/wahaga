const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
  isJidBroadcast,
  proto,
  getAggregateVotesInPollMessage,
  Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const QRCode = require('qrcode');
const config = require('../config');
const { logger, createSessionLogger } = require('../utils/logger');
const { formatJid, ensureDir, sleep } = require('../utils/helpers');
const cacheService = require('./cache.service');
const prisma = require('../config/prisma');

class WhatsAppService {
  constructor() {
    // Store active sessions: Map<sessionName, socket>
    this.sessions = new Map();
    // Store session states: Map<sessionName, { status, qr, phone, etc }>
    this.states = new Map();
    // Event handlers
    this.eventHandlers = [];
    // Session storage directory
    this.sessionDir = config.paths.sessions;
    ensureDir(this.sessionDir);
  }

  /**
   * Register event handler
   * @param {Function} handler - Event handler function(sessionName, event, data)
   */
  onEvent(handler) {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit event to all handlers
   * @param {string} sessionName - Session name
   * @param {string} event - Event type
   * @param {any} data - Event data
   */
  async emitEvent(sessionName, event, data) {
    for (const handler of this.eventHandlers) {
      try {
        await handler(sessionName, event, data);
      } catch (error) {
        logger.error({ error, sessionName, event }, 'Event handler error');
      }
    }
  }

  /**
   * Get session socket
   * @param {string} sessionName - Session name
   * @returns {object|null}
   */
  getSession(sessionName) {
    return this.sessions.get(sessionName) || null;
  }

  /**
   * Get session state
   * @param {string} sessionName - Session name
   * @returns {object}
   */
  getState(sessionName) {
    return this.states.get(sessionName) || { status: 'disconnected' };
  }

  /**
   * Get all sessions
   * @returns {Array}
   */
  getAllSessions() {
    const sessions = [];
    for (const [name, socket] of this.sessions) {
      const state = this.states.get(name) || {};
      sessions.push({
        name,
        ...state,
        isConnected: socket?.user ? true : false,
      });
    }
    return sessions;
  }

  /**
   * Create or reconnect a session
   * @param {string} sessionName - Unique session name
   * @param {object} options - Session options
   * @returns {Promise<object>}
   */
  async createSession(sessionName, options = {}) {
    const sessionLogger = createSessionLogger(sessionName);
    sessionLogger.info('Creating session');

    // Check if session already exists
    if (this.sessions.has(sessionName)) {
      const socket = this.sessions.get(sessionName);
      if (socket?.user) {
        sessionLogger.info('Session already connected');
        return { success: true, message: 'Session already connected' };
      }
    }

    // Check max sessions limit
    if (this.sessions.size >= config.whatsapp.maxSessions) {
      throw new Error(`Maximum sessions limit (${config.whatsapp.maxSessions}) reached`);
    }

    try {
      // Setup auth state
      const sessionPath = path.join(this.sessionDir, sessionName);
      ensureDir(sessionPath);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Create socket options with group caching
      const socketOptions = {
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'warn' }),
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: true,
        markOnlineOnConnect: false,
        // Group metadata cache - required for group messaging
        cachedGroupMetadata: async (jid) => {
          return cacheService.getGroupMetadata(jid);
        },
        // Get message for polls/reactions
        getMessage: async (key) => {
          const msg = await cacheService.getMessage(sessionName, key.id);
          return msg?.message || undefined;
        },
      };

      // Create socket
      const socket = makeWASocket(socketOptions);

      // Store session
      this.sessions.set(sessionName, socket);
      this.states.set(sessionName, {
        status: 'connecting',
        phone: null,
        pushName: null,
        qr: null,
        qrBase64: null,
      });

      // Update database
      await this.updateSessionInDb(sessionName, { status: 'connecting' });

      // Bind event handlers
      this.bindEvents(sessionName, socket, saveCreds, sessionLogger);

      return { success: true, message: 'Session created, waiting for QR scan' };
    } catch (error) {
      sessionLogger.error({ error }, 'Failed to create session');
      this.states.set(sessionName, { status: 'error', error: error.message });
      throw error;
    }
  }

  /**
   * Bind socket event handlers
   * @param {string} sessionName - Session name
   * @param {object} socket - Baileys socket
   * @param {Function} saveCreds - Save credentials function
   * @param {object} loggerInstance - Logger instance
   */
  bindEvents(sessionName, socket, saveCreds, loggerInstance) {
    // Connection update
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const state = this.states.get(sessionName) || {};

      // Check if pairing code should be requested (when connecting or QR available)
      if ((connection === 'connecting' || qr) && state.pendingPairingPhone) {
        try {
          const code = await socket.requestPairingCode(state.pendingPairingPhone);
          loggerInstance.info({ phone: state.pendingPairingPhone, code }, 'Pairing code generated');
          this.states.set(sessionName, {
            ...state,
            status: 'pairing',
            pairingCode: code,
            pendingPairingPhone: null, // Clear pending
          });
          await this.emitEvent(sessionName, 'pairing.code', { code, phone: state.pendingPairingPhone });
        } catch (e) {
          loggerInstance.error({ error: e }, 'Failed to request pairing code');
          this.states.set(sessionName, {
            ...state,
            pairingError: e.message,
            pendingPairingPhone: null,
          });
        }
        return; // Don't generate QR if pairing code was requested
      }

      // QR Code received (only if not using pairing code)
      if (qr && !state.pendingPairingPhone) {
        loggerInstance.info('QR code received');
        const qrBase64 = await QRCode.toDataURL(qr);
        this.states.set(sessionName, {
          ...state,
          status: 'qr',
          qr,
          qrBase64,
        });
        await this.updateSessionInDb(sessionName, { status: 'qr', qrCode: qrBase64 });
        // WAHA: session.status with SCAN_QR_CODE status
        await this.emitEvent(sessionName, 'session.status', { status: 'SCAN_QR_CODE', qr, qrBase64 });
      }

      // Connection status
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output.statusCode
          : 500;

        loggerInstance.warn({ statusCode }, 'Connection closed');

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const state = this.states.get(sessionName) || {};
        
        // Stream error (515) or restart needed - clear QR and reconnect
        if (statusCode === 515 || statusCode === 405) {
          loggerInstance.info('Stream error, clearing session and reconnecting...');
          // Clear QR so new one is generated
          this.states.set(sessionName, { ...state, status: 'connecting', qr: null, qrBase64: null, retryCount: 0 });
          await sleep(2000);
          await this.createSession(sessionName);
          return;
        }
        
        // If we have a QR code and not a critical error, wait for scan
        if (state.qrBase64 && statusCode !== 401) {
          loggerInstance.info('QR code available, waiting for scan...');
          this.states.set(sessionName, { ...state, status: 'qr' });
          return;
        }
        
        if (shouldReconnect) {
          const retryCount = (state.retryCount || 0) + 1;
          
          if (retryCount <= config.whatsapp.maxRetries) {
            loggerInstance.info({ retryCount }, 'Reconnecting...');
            this.states.set(sessionName, { ...state, status: 'reconnecting', retryCount });
            await sleep(config.whatsapp.retryInterval);
            await this.createSession(sessionName);
          } else {
            loggerInstance.error('Max retries reached, giving up');
            this.states.set(sessionName, { ...state, status: 'disconnected' });
            await this.updateSessionInDb(sessionName, { status: 'disconnected' });
          }
        } else {
          // Logged out, clean up
          loggerInstance.info('Session logged out');
          await this.deleteSession(sessionName, false);
        }

        await this.emitEvent(sessionName, 'connection.close', { statusCode, shouldReconnect });
      }

      if (connection === 'open') {
        loggerInstance.info('Connection opened');
        const user = socket.user;
        const state = {
          status: 'connected',
          phone: user?.id?.split(':')[0] || user?.id?.split('@')[0],
          pushName: user?.name,
          qr: null,
          qrBase64: null,
          retryCount: 0,
        };
        this.states.set(sessionName, state);
        await this.updateSessionInDb(sessionName, {
          status: 'connected',
          phone: state.phone,
          pushName: state.pushName,
          qrCode: null,
        });
        // WAHA: session.status with WORKING status
        await this.emitEvent(sessionName, 'session.status', { status: 'WORKING', phone: state.phone, pushName: state.pushName });
      }
    });

    // Credentials update
    socket.ev.on('creds.update', saveCreds);

    // Messages upsert (new messages)
    socket.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      try {
        const session = await prisma.session.findFirst({ where: { name: sessionName } });
        
        for (const msg of m.messages) {
          // Skip status broadcast
          if (isJidBroadcast(msg.key.remoteJid)) continue;

          // Cache message for getMessage callback
          await cacheService.setMessage(sessionName, msg.key.id, msg);

          // Parse message content
          const messageContent = msg.message;
          let type = 'unknown';
          let content = '';
          let caption = null;
          let mimetype = null;

          if (messageContent?.conversation) {
            type = 'text';
            content = messageContent.conversation;
          } else if (messageContent?.extendedTextMessage) {
            type = 'text';
            content = messageContent.extendedTextMessage.text;
          } else if (messageContent?.imageMessage) {
            type = 'image';
            caption = messageContent.imageMessage.caption || null;
            mimetype = messageContent.imageMessage.mimetype;
          } else if (messageContent?.videoMessage) {
            type = 'video';
            caption = messageContent.videoMessage.caption || null;
            mimetype = messageContent.videoMessage.mimetype;
          } else if (messageContent?.audioMessage) {
            type = 'audio';
            mimetype = messageContent.audioMessage.mimetype;
          } else if (messageContent?.documentMessage) {
            type = 'document';
            content = messageContent.documentMessage.fileName || '';
            mimetype = messageContent.documentMessage.mimetype;
          } else if (messageContent?.stickerMessage) {
            type = 'sticker';
            mimetype = messageContent.stickerMessage.mimetype;
          } else if (messageContent?.locationMessage) {
            type = 'location';
            content = JSON.stringify({
              lat: messageContent.locationMessage.degreesLatitude,
              lng: messageContent.locationMessage.degreesLongitude,
            });
          } else if (messageContent?.contactMessage) {
            type = 'contact';
            content = messageContent.contactMessage.displayName;
          } else if (messageContent?.reactionMessage) {
            type = 'reaction';
            content = messageContent.reactionMessage.text;
          }

          // Save to database
          if (session) {
            try {
              await prisma.message.upsert({
                where: { messageId: msg.key.id },
                update: { status: 'received' },
                create: {
                  messageId: msg.key.id,
                  sessionId: session.id,
                  remoteJid: msg.key.remoteJid,
                  fromMe: msg.key.fromMe || false,
                  type,
                  content: content || null,
                  caption,
                  mimetype,
                  status: 'received',
                  timestamp: msg.messageTimestamp 
                    ? new Date(Number(msg.messageTimestamp) * 1000) 
                    : new Date(),
                },
              });
            } catch (dbError) {
              loggerInstance.warn({ error: dbError.message, messageId: msg.key.id }, 'Failed to save message to DB');
            }
          }

          // WAHA: message event for incoming messages
          await this.emitEvent(sessionName, 'message', {
            id: msg.key.id,
            from: msg.key.remoteJid,
            fromMe: msg.key.fromMe,
            timestamp: msg.messageTimestamp,
            body: content || caption || '',
            hasMedia: ['image', 'video', 'audio', 'document', 'sticker'].includes(type),
            type,
            _data: msg,
          });
          // Also emit message.any for all messages
          await this.emitEvent(sessionName, 'message.any', {
            id: msg.key.id,
            from: msg.key.remoteJid,
            fromMe: msg.key.fromMe,
            timestamp: msg.messageTimestamp,
            body: content || caption || '',
            hasMedia: ['image', 'video', 'audio', 'document', 'sticker'].includes(type),
            type,
            source: msg.key.fromMe ? 'api' : 'app',
            _data: msg,
          });
        }
      } catch (error) {
        loggerInstance.error({ error }, 'Error processing message upsert');
      }
    });

    // Messages update (status changes) - WAHA: message.ack
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        const ackNames = { 0: 'PENDING', 1: 'SERVER', 2: 'DEVICE', 3: 'READ', 4: 'PLAYED', '-1': 'ERROR' };
        const ack = update.update?.status || 0;
        await this.emitEvent(sessionName, 'message.ack', {
          id: update.key?.id,
          from: update.key?.remoteJid,
          fromMe: update.key?.fromMe,
          ack,
          ackName: ackNames[ack] || 'PENDING',
          participant: update.key?.participant || null,
        });
      }
    });

    // Message receipt (delivery/read)
    socket.ev.on('message-receipt.update', async (updates) => {
      for (const update of updates) {
        await this.emitEvent(sessionName, 'message.receipt', { update, sessionName });
      }
    });

    // Presence update
    socket.ev.on('presence.update', async (update) => {
      await this.emitEvent(sessionName, 'presence.update', { update, sessionName });
    });

    // Groups update - WAHA: group.v2.join, group.v2.update
    socket.ev.on('groups.upsert', async (groups) => {
      for (const group of groups) {
        await cacheService.setGroupMetadata(group.id, group);
        // WAHA: group.v2.join when joining new group
        await this.emitEvent(sessionName, 'group.v2.join', {
          group: {
            id: group.id,
            subject: group.subject,
            description: group.desc,
            participants: group.participants || [],
          },
          timestamp: Date.now(),
          _data: group,
        });
      }
    });

    socket.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        // WAHA: group.v2.update
        await this.emitEvent(sessionName, 'group.v2.update', {
          group: {
            id: update.id,
            subject: update.subject,
            description: update.desc,
          },
          timestamp: Date.now(),
          _data: update,
        });
      }
    });

    socket.ev.on('group-participants.update', async (update) => {
      // WAHA: group.v2.participants
      await this.emitEvent(sessionName, 'group.v2.participants', {
        type: update.action, // join, leave, promote, demote
        group: { id: update.id },
        participants: update.participants?.map(p => ({ id: p })) || [],
        timestamp: Date.now(),
        _data: update,
      });
    });

    // Contacts update
    socket.ev.on('contacts.upsert', async (contacts) => {
      await this.emitEvent(sessionName, 'contacts.upsert', { contacts, sessionName });
    });

    // Call events - WAHA: call.received, call.accepted, call.rejected
    socket.ev.on('call', async (calls) => {
      for (const call of calls) {
        let eventName = 'call.received';
        if (call.status === 'accept') eventName = 'call.accepted';
        else if (call.status === 'reject' || call.status === 'timeout') eventName = 'call.rejected';
        
        await this.emitEvent(sessionName, eventName, {
          id: call.id,
          from: call.from,
          timestamp: call.date || Date.now(),
          isVideo: call.isVideo || false,
          isGroup: call.isGroup || false,
          status: call.status,
          _data: call,
        });
      }
    });

    // Labels events - WAHA: label.upsert, label.deleted, label.chat.added, label.chat.deleted
    socket.ev.on('labels.edit', async (label) => {
      await this.emitEvent(sessionName, 'label.upsert', {
        id: label.id,
        name: label.name,
        color: label.color,
        _data: label,
      });
    });

    socket.ev.on('labels.association', async (association) => {
      const eventName = association.type === 'add' ? 'label.chat.added' : 'label.chat.deleted';
      await this.emitEvent(sessionName, eventName, {
        labelId: association.labelId,
        chatId: association.chatId,
        type: association.type,
        _data: association,
      });
    });

    // History sync - receive old chats, contacts and messages
    socket.ev.on('messaging-history.set', async ({ chats: newChats, contacts: newContacts, messages: newMessages, syncType }) => {
      loggerInstance.info({ 
        chats: newChats?.length || 0, 
        contacts: newContacts?.length || 0, 
        messages: newMessages?.length || 0,
        syncType 
      }, 'History sync received');

      // Store contacts
      if (newContacts && newContacts.length > 0) {
        const state = this.states.get(sessionName) || {};
        const syncedContacts = state.syncedContacts || {};
        for (const contact of newContacts) {
          syncedContacts[contact.id] = contact;
        }
        this.states.set(sessionName, { ...state, syncedContacts });
      }

      // Store chats
      if (newChats && newChats.length > 0) {
        const state = this.states.get(sessionName) || {};
        const syncedChats = state.syncedChats || {};
        for (const chat of newChats) {
          syncedChats[chat.id] = chat;
        }
        this.states.set(sessionName, { ...state, syncedChats });
      }

      // Store messages in cache AND database
      if (newMessages && newMessages.length > 0) {
        try {
          const session = await prisma.session.findFirst({ where: { name: sessionName } });
          if (session) {
            for (const msg of newMessages) {
              await cacheService.setMessage(sessionName, msg.key.id, msg);
              
              // Get message content
              const messageContent = msg.message;
              let type = 'unknown';
              let content = '';
              
              if (messageContent?.conversation) {
                type = 'text';
                content = messageContent.conversation;
              } else if (messageContent?.extendedTextMessage) {
                type = 'text';
                content = messageContent.extendedTextMessage.text;
              } else if (messageContent?.imageMessage) {
                type = 'image';
                content = messageContent.imageMessage.caption || '';
              } else if (messageContent?.videoMessage) {
                type = 'video';
                content = messageContent.videoMessage.caption || '';
              } else if (messageContent?.audioMessage) {
                type = 'audio';
              } else if (messageContent?.documentMessage) {
                type = 'document';
                content = messageContent.documentMessage.fileName || '';
              }

              // Save to database (upsert to avoid duplicates)
              await prisma.message.upsert({
                where: { messageId: msg.key.id },
                update: {},
                create: {
                  messageId: msg.key.id,
                  sessionId: session.id,
                  remoteJid: msg.key.remoteJid,
                  fromMe: msg.key.fromMe || false,
                  type,
                  content,
                  status: 'received',
                  timestamp: msg.messageTimestamp 
                    ? new Date(Number(msg.messageTimestamp) * 1000) 
                    : new Date(),
                },
              });
            }
          }
        } catch (e) {
          loggerInstance.warn({ error: e.message }, 'Failed to save synced messages to database');
        }
      }

      await this.emitEvent(sessionName, 'history.sync', { 
        chatsCount: newChats?.length || 0,
        contactsCount: newContacts?.length || 0,
        messagesCount: newMessages?.length || 0,
        syncType,
        sessionName 
      });
    });

    // Chats update
    socket.ev.on('chats.upsert', async (chats) => {
      await this.emitEvent(sessionName, 'chats.upsert', { chats, sessionName });
    });

    // Call events
    socket.ev.on('call', async (calls) => {
      await this.emitEvent(sessionName, 'call', { calls, sessionName });
    });
  }

  /**
   * Update session in database
   * @param {string} sessionName - Session name
   * @param {object} data - Data to update
   */
  async updateSessionInDb(sessionName, data) {
    try {
      await prisma.session.upsert({
        where: { name: sessionName },
        update: {
          ...data,
          updatedAt: new Date(),
        },
        create: {
          name: sessionName,
          ...data,
        },
      });
    } catch (error) {
      logger.error({ error, sessionName }, 'Failed to update session in database');
    }
  }

  /**
   * Delete a session
   * @param {string} sessionName - Session name
   * @param {boolean} logout - Whether to logout from WhatsApp
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionName, logout = true) {
    const sessionLogger = createSessionLogger(sessionName);
    sessionLogger.info({ logout }, 'Deleting session');

    try {
      const socket = this.sessions.get(sessionName);
      
      if (socket) {
        if (logout) {
          try {
            await socket.logout();
          } catch (e) {
            // Ignore logout errors
          }
        }
        socket.end();
      }

      // Remove from memory
      this.sessions.delete(sessionName);
      this.states.delete(sessionName);

      // Delete session files
      const sessionPath = path.join(this.sessionDir, sessionName);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      // Delete from database
      await prisma.session.deleteMany({ where: { name: sessionName } });

      // Clear cache
      await cacheService.delByPattern(`msg:${sessionName}:*`);

      await this.emitEvent(sessionName, 'session.deleted', {});

      return true;
    } catch (error) {
      sessionLogger.error({ error }, 'Failed to delete session');
      throw error;
    }
  }

  /**
   * Restart a session
   * @param {string} sessionName - Session name
   * @returns {Promise<object>}
   */
  async restartSession(sessionName) {
    const socket = this.sessions.get(sessionName);
    if (socket) {
      socket.end();
      this.sessions.delete(sessionName);
    }
    await sleep(1000);
    return this.createSession(sessionName);
  }

  /**
   * Request pairing code for session (alternative to QR scan)
   * @param {string} sessionName - Session name
   * @param {string} phoneNumber - Phone number in E.164 format without + (e.g., 628123456789)
   * @returns {Promise<object>} - { code: "XXXXXXXX" }
   */
  async requestPairingCode(sessionName, phoneNumber) {
    const state = this.states.get(sessionName);
    if (state?.status === 'connected') {
      throw new Error('Session already connected');
    }

    // Format phone number - remove + and non-digits (E.164 format without +)
    const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    // Check if session socket exists
    let socket = this.getSession(sessionName);
    
    if (!socket) {
      // Set pending phone BEFORE creating session so event handler picks it up
      this.states.set(sessionName, {
        ...state,
        status: 'connecting',
        pendingPairingPhone: formattedPhone,
      });
      
      // Start the session - event handler will request pairing code
      await this.createSession(sessionName);
      
      // Wait for pairing code to be generated (max 10 seconds)
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        const currentState = this.states.get(sessionName);
        if (currentState?.pairingCode) {
          return { code: currentState.pairingCode };
        }
        if (currentState?.pairingError) {
          throw new Error(currentState.pairingError);
        }
      }
      
      throw new Error('Timeout waiting for pairing code. Please try again.');
    }
    
    // If socket exists, request directly (already connecting)
    try {
      const code = await socket.requestPairingCode(formattedPhone);
      this.states.set(sessionName, {
        ...state,
        status: 'pairing',
        pairingCode: code,
      });
      logger.info({ sessionName, phone: formattedPhone }, 'Pairing code requested');
      return { code };
    } catch (error) {
      logger.error({ error, sessionName }, 'Failed to request pairing code');
      throw error;
    }
  }

  /**
   * Get QR code for session
   * @param {string} sessionName - Session name
   * @returns {object}
   */
  getQR(sessionName) {
    const state = this.states.get(sessionName);
    // Return QR if available, regardless of exact status
    if (!state || !state.qrBase64) {
      return null;
    }
    return {
      qr: state.qr,
      qrBase64: state.qrBase64,
    };
  }

  /**
   * Check if number is registered on WhatsApp
   * @param {string} sessionName - Session name
   * @param {string} phone - Phone number
   * @returns {Promise<object>}
   */
  async isRegistered(sessionName, phone) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = formatJid(phone);
    const [result] = await socket.onWhatsApp(jid);
    return {
      exists: result?.exists || false,
      jid: result?.jid || jid,
    };
  }

  /**
   * Send text message
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID or phone
   * @param {string} text - Message text
   * @param {object} options - Additional options
   * @returns {Promise<object>}
   */
  async sendText(sessionName, to, text, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    const message = {
      text,
      ...options,
    };

    const result = await socket.sendMessage(jid, message);
    
    // Cache sent message
    await cacheService.setMessage(sessionName, result.key.id, result);
    
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });
    
    return result;
  }

  /**
   * Send media message
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID or phone
   * @param {string} type - Media type (image, video, audio, document)
   * @param {Buffer|string} media - Media buffer or URL
   * @param {object} options - Caption, filename, etc.
   * @returns {Promise<object>}
   */
  async sendMedia(sessionName, to, type, media, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    let message = {};
    const mediaKey = type === 'audio' ? 'audio' : 
                     type === 'video' ? 'video' : 
                     type === 'document' ? 'document' : 'image';

    // Determine if media is URL or buffer
    if (typeof media === 'string' && (media.startsWith('http://') || media.startsWith('https://'))) {
      message[mediaKey] = { url: media };
    } else if (typeof media === 'string' && fs.existsSync(media)) {
      message[mediaKey] = fs.readFileSync(media);
    } else {
      message[mediaKey] = media;
    }

    // Add caption
    if (options.caption) {
      message.caption = options.caption;
    }

    // Add filename for documents
    if (type === 'document' && options.filename) {
      message.fileName = options.filename;
    }

    // Add mimetype
    if (options.mimetype) {
      message.mimetype = options.mimetype;
    }

    // PTT for voice notes
    if (type === 'audio' && options.ptt) {
      message.ptt = true;
    }

    const result = await socket.sendMessage(jid, message);
    
    // Cache sent message
    await cacheService.setMessage(sessionName, result.key.id, result);
    
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });
    
    return result;
  }

  /**
   * Send location
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID or phone
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {object} options - Name, address
   * @returns {Promise<object>}
   */
  async sendLocation(sessionName, to, latitude, longitude, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    const result = await socket.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: options.name,
        address: options.address,
      },
    });
    
    await cacheService.setMessage(sessionName, result.key.id, result);
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });
    
    return result;
  }

  /**
   * Send contact/vcard
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID or phone
   * @param {object} contact - Contact info { name, phone }
   * @returns {Promise<object>}
   */
  async sendContact(sessionName, to, contact) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.name}
TEL;type=CELL;type=VOICE;waid=${contact.phone}:${contact.phone}
END:VCARD`;

    const result = await socket.sendMessage(jid, {
      contacts: {
        displayName: contact.name,
        contacts: [{ vcard }],
      },
    });
    
    await cacheService.setMessage(sessionName, result.key.id, result);
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });
    
    return result;
  }

  /**
   * Send button message (deprecated in WhatsApp, may not work)
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient
   * @param {string} text - Button text
   * @param {Array} buttons - Buttons array
   * @param {object} options - Footer, header
   * @returns {Promise<object>}
   */
  async sendButtons(sessionName, to, text, buttons, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    const result = await socket.sendMessage(jid, {
      text,
      footer: options.footer,
      buttons: buttons.map((btn, i) => ({
        buttonId: btn.id || `btn_${i}`,
        buttonText: { displayText: btn.text },
        type: 1,
      })),
      headerType: 1,
    });
    
    await cacheService.setMessage(sessionName, result.key.id, result);
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });
    
    return result;
  }

  /**
   * Forward message to another chat
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID
   * @param {object} messageKey - Original message key { id, remoteJid, fromMe }
   * @returns {Promise<object>}
   */
  async forwardMessage(sessionName, to, messageKey) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    // Get original message from cache
    const originalMessage = await cacheService.getMessage(sessionName, messageKey.id);
    if (!originalMessage) {
      throw new Error('Original message not found in cache');
    }

    const result = await socket.sendMessage(jid, { forward: originalMessage });
    
    await cacheService.setMessage(sessionName, result.key.id, result);
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });
    
    return result;
  }

  /**
   * Send seen/read receipt
   * @param {string} sessionName - Session name
   * @param {string} jid - Chat JID
   * @param {Array<string>} messageIds - Array of message IDs to mark as read
   * @returns {Promise<void>}
   */
  async sendSeen(sessionName, jid, messageIds) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const chatJid = jid.includes('@') ? jid : formatJid(jid, jid.includes('-'));
    
    const keys = messageIds.map(id => ({
      remoteJid: chatJid,
      id,
      fromMe: false,
    }));

    await socket.readMessages(keys);
    logger.info({ sessionName, jid: chatJid, count: messageIds.length }, 'Messages marked as read');
  }

  /**
   * Send typing indicator
   * @param {string} sessionName - Session name
   * @param {string} jid - Chat JID
   * @param {string} action - 'composing' (start) or 'paused' (stop)
   * @returns {Promise<void>}
   */
  async sendTyping(sessionName, jid, action = 'composing') {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const chatJid = jid.includes('@') ? jid : formatJid(jid, jid.includes('-'));
    await socket.sendPresenceUpdate(action, chatJid);
    logger.info({ sessionName, jid: chatJid, action }, 'Typing indicator sent');
  }

  /**
   * Send reaction to a message
   * @param {string} sessionName - Session name
   * @param {object} messageKey - Message key { id, remoteJid, fromMe }
   * @param {string} emoji - Reaction emoji (empty string to remove)
   * @returns {Promise<object>}
   */
  async sendReaction(sessionName, messageKey, emoji) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const result = await socket.sendMessage(messageKey.remoteJid, {
      react: {
        text: emoji,
        key: messageKey,
      },
    });

    logger.info({ sessionName, messageId: messageKey.id, emoji }, 'Reaction sent');
    return result;
  }

  /**
   * Star/unstar a message
   * @param {string} sessionName - Session name
   * @param {object} messageKey - Message key { id, remoteJid, fromMe }
   * @param {boolean} star - true to star, false to unstar
   * @returns {Promise<void>}
   */
  async starMessage(sessionName, messageKey, star = true) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.chatModify({ star: { messages: [messageKey], star } }, messageKey.remoteJid);
    logger.info({ sessionName, messageId: messageKey.id, star }, 'Message star updated');
  }

  /**
   * Send a poll
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID
   * @param {string} name - Poll question/name
   * @param {Array<string>} options - Poll options
   * @param {object} settings - { selectableCount: 1 }
   * @returns {Promise<object>}
   */
  async sendPoll(sessionName, to, name, options, settings = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    
    const result = await socket.sendMessage(jid, {
      poll: {
        name,
        values: options,
        selectableCount: settings.selectableCount || 1,
      },
    });

    await cacheService.setMessage(sessionName, result.key.id, result);
    await this.emitEvent(sessionName, 'message.sent', { message: result, sessionName });

    return result;
  }

  /**
   * Vote on a poll
   * @param {string} sessionName - Session name
   * @param {object} pollMessageKey - Poll message key { id, remoteJid, fromMe }
   * @param {Array<string>} selectedOptions - Array of selected option names
   * @returns {Promise<object>}
   */
  async sendPollVote(sessionName, pollMessageKey, selectedOptions) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Get poll message from cache
    const pollMessage = await cacheService.getMessage(sessionName, pollMessageKey.id);
    if (!pollMessage) {
      throw new Error('Poll message not found in cache');
    }

    const result = await socket.sendMessage(pollMessageKey.remoteJid, {
      pollUpdate: {
        pollMessageKey,
        selectedOptions,
      },
    });

    logger.info({ sessionName, pollId: pollMessageKey.id, votes: selectedOptions }, 'Poll vote sent');
    return result;
  }

  /**
   * Get chats list
   * @param {string} sessionName - Session name
   * @returns {Promise<Array>}
   */
  async getChats(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Get from store if available
    const chats = await socket.groupFetchAllParticipating();
    return Object.values(chats);
  }

  /**
   * Get contacts
   * @param {string} sessionName - Session name
   * @returns {Promise<object>}
   */
  async getContacts(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Contacts are not directly available, return empty
    return {};
  }

  /**
   * Get group metadata
   * @param {string} sessionName - Session name
   * @param {string} groupJid - Group JID
   * @returns {Promise<object>}
   */
  async getGroupMetadata(sessionName, groupJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Try cache first
    let metadata = await cacheService.getGroupMetadata(groupJid);
    if (!metadata) {
      metadata = await socket.groupMetadata(groupJid);
      await cacheService.setGroupMetadata(groupJid, metadata);
    }
    return metadata;
  }

  /**
   * Create group
   * @param {string} sessionName - Session name
   * @param {string} name - Group name
   * @param {Array} participants - Participant phone numbers
   * @returns {Promise<object>}
   */
  async createGroup(sessionName, name, participants) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jids = participants.map((p) => formatJid(p));
    const result = await socket.groupCreate(name, jids);
    await cacheService.setGroupMetadata(result.id, result);
    return result;
  }

  /**
   * Add participants to group
   * @param {string} sessionName - Session name
   * @param {string} groupJid - Group JID
   * @param {Array} participants - Participant phone numbers
   * @returns {Promise<object>}
   */
  async addParticipants(sessionName, groupJid, participants) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jids = participants.map((p) => formatJid(p));
    return socket.groupParticipantsUpdate(groupJid, jids, 'add');
  }

  /**
   * Remove participants from group
   * @param {string} sessionName - Session name
   * @param {string} groupJid - Group JID
   * @param {Array} participants - Participant phone numbers
   * @returns {Promise<object>}
   */
  async removeParticipants(sessionName, groupJid, participants) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jids = participants.map((p) => formatJid(p));
    return socket.groupParticipantsUpdate(groupJid, jids, 'remove');
  }

  /**
   * Leave group
   * @param {string} sessionName - Session name
   * @param {string} groupJid - Group JID
   * @returns {Promise<void>}
   */
  async leaveGroup(sessionName, groupJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    return socket.groupLeave(groupJid);
  }

  /**
   * Get group invite code
   * @param {string} sessionName - Session name
   * @param {string} groupJid - Group JID
   * @returns {Promise<string>}
   */
  async getInviteCode(sessionName, groupJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    return socket.groupInviteCode(groupJid);
  }

  /**
   * Get profile picture URL
   * @param {string} sessionName - Session name
   * @param {string} jid - JID
   * @returns {Promise<string>}
   */
  async getProfilePicture(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    try {
      return await socket.profilePictureUrl(jid, 'image');
    } catch (e) {
      return null;
    }
  }

  /**
   * Download and save profile picture to server
   * @param {string} sessionName - Session name
   * @param {string} jid - JID
   * @returns {Promise<object>} - { url, localPath, filename }
   */
  async downloadProfilePicture(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    try {
      const url = await socket.profilePictureUrl(jid, 'image');
      if (!url) {
        return { url: null, localPath: null, filename: null };
      }

      // Download image
      const axios = require('axios');
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      
      // Generate filename
      const jidClean = jid.replace('@', '_').replace('.', '_');
      const timestamp = Date.now();
      const filename = `profile_${jidClean}_${timestamp}.jpg`;
      
      // Save to uploads directory
      const uploadDir = config.paths.uploads;
      ensureDir(uploadDir);
      const localPath = path.join(uploadDir, filename);
      
      fs.writeFileSync(localPath, response.data);
      
      // Return relative URL path
      const relativeUrl = `/images/${filename}`;
      
      return {
        originalUrl: url,
        localPath: relativeUrl,
        filename,
        size: response.data.length,
      };
    } catch (e) {
      logger.error({ error: e, jid }, 'Failed to download profile picture');
      return { url: null, localPath: null, filename: null, error: e.message };
    }
  }

  /**
   * Get my profile info
   * @param {string} sessionName - Session name
   * @returns {Promise<object>}
   */
  async getMyProfile(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const state = this.states.get(sessionName);
    const me = socket.user;
    
    let profilePicture = null;
    try {
      if (me?.id) {
        const picResult = await this.downloadProfilePicture(sessionName, me.id);
        if (picResult.localPath) {
          profilePicture = picResult.localPath;
        }
      }
    } catch (e) {
      // Ignore profile picture errors
    }

    // Get status/about
    let status = null;
    try {
      const statusResult = await socket.fetchStatus(me?.id);
      status = statusResult?.status || null;
    } catch (e) {
      // Ignore status errors
    }

    return {
      id: me?.id,
      phone: state?.phone || me?.id?.split('@')[0],
      name: me?.name || state?.pushName,
      status,
      profilePicture,
    };
  }

  /**
   * Set profile name (push name)
   * @param {string} sessionName - Session name
   * @param {string} name - New profile name
   * @returns {Promise<void>}
   */
  async setProfileName(sessionName, name) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.updateProfileName(name);
    logger.info({ sessionName, name }, 'Profile name updated');
  }

  /**
   * Set profile status (about)
   * @param {string} sessionName - Session name
   * @param {string} status - New status/about text
   * @returns {Promise<void>}
   */
  async setProfileStatus(sessionName, status) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.updateProfileStatus(status);
    logger.info({ sessionName, status }, 'Profile status updated');
  }

  /**
   * Set profile picture
   * @param {string} sessionName - Session name
   * @param {Buffer|string} image - Image buffer or base64 string or URL
   * @returns {Promise<void>}
   */
  async setProfilePicture(sessionName, image) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const me = socket.user;
    if (!me?.id) {
      throw new Error('User not initialized');
    }

    let imgBuffer;
    
    if (Buffer.isBuffer(image)) {
      imgBuffer = image;
    } else if (typeof image === 'string') {
      // Check if it's a URL
      if (image.startsWith('http://') || image.startsWith('https://')) {
        try {
          const axios = require('axios');
          const response = await axios.get(image, { 
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 30000,
          });
          imgBuffer = Buffer.from(response.data);
        } catch (e) {
          throw new Error(`Failed to download image from URL: ${e.response?.status || e.message}. URL must be publicly accessible.`);
        }
      } else {
        // It's base64
        // Remove data URL prefix if present (handles various formats)
        let base64Data = image;
        if (image.includes('base64,')) {
          base64Data = image.split('base64,')[1];
        }
        imgBuffer = Buffer.from(base64Data, 'base64');
      }
    } else {
      throw new Error('Image must be a Buffer, base64 string, or URL');
    }

    // Validate buffer is not empty
    if (!imgBuffer || imgBuffer.length === 0) {
      throw new Error('Image data is empty');
    }

    await socket.updateProfilePicture(me.id, imgBuffer);
    logger.info({ sessionName, size: imgBuffer.length }, 'Profile picture updated');
  }

  /**
   * Delete profile picture
   * @param {string} sessionName - Session name
   * @returns {Promise<void>}
   */
  async deleteProfilePicture(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const me = socket.user;
    if (!me?.id) {
      throw new Error('User not initialized');
    }

    await socket.removeProfilePicture(me.id);
    logger.info({ sessionName }, 'Profile picture removed');
  }

  /**
   * Set presence (typing, recording, etc)
   * @param {string} sessionName - Session name
   * @param {string} jid - Chat JID
   * @param {string} presence - Presence type (composing, recording, paused)
   * @returns {Promise<void>}
   */
  async setPresence(sessionName, jid, presence) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.sendPresenceUpdate(presence, jid);
  }

  /**
   * Read messages (mark as read)
   * @param {string} sessionName - Session name
   * @param {Array} keys - Message keys
   * @returns {Promise<void>}
   */
  async readMessages(sessionName, keys) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.readMessages(keys);
  }

  /**
   * Initialize all sessions from database
   * @returns {Promise<void>}
   */
  async initializeSessions() {
    logger.info('Initializing sessions from database');
    
    try {
      const sessions = await prisma.session.findMany({
        where: {
          status: {
            in: ['connected', 'connecting', 'qr'],
          },
        },
      });

      for (const session of sessions) {
        try {
          await this.createSession(session.name);
          logger.info({ sessionName: session.name }, 'Session initialized');
        } catch (error) {
          logger.error({ error, sessionName: session.name }, 'Failed to initialize session');
        }
      }

      logger.info({ count: sessions.length }, 'Sessions initialization complete');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize sessions');
    }
  }

  /**
   * Cleanup all sessions
   * @returns {Promise<void>}
   */
  async cleanup() {
    logger.info('Cleaning up sessions');
    
    for (const [name, socket] of this.sessions) {
      try {
        socket.end();
      } catch (e) {
        // Ignore
      }
    }
    
    this.sessions.clear();
    this.states.clear();
    await cacheService.close();
  }

  // ==================== CONTACT METHODS ====================

  /**
   * Get all contacts (from chat history)
   * @param {string} sessionName - Session name
   * @returns {Promise<Array>}
   */
  async getContacts(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    
    const contacts = [];
    
    // Get from synced contacts (from history sync)
    const state = this.states.get(sessionName) || {};
    const syncedContacts = state.syncedContacts || {};
    for (const [jid, contact] of Object.entries(syncedContacts)) {
      if (jid.endsWith('@s.whatsapp.net')) {
        contacts.push({
          jid,
          phone: jid.split('@')[0],
          name: contact?.name || contact?.notify || null,
          source: 'history_sync',
        });
      }
    }

    // Get from synced chats (from history sync)
    const syncedChats = state.syncedChats || {};
    for (const [chatId, chat] of Object.entries(syncedChats)) {
      if (chatId.endsWith('@s.whatsapp.net') && !contacts.find(c => c.jid === chatId)) {
        contacts.push({
          jid: chatId,
          phone: chatId.split('@')[0],
          name: chat?.name || null,
          source: 'history_sync_chats',
        });
      }
    }
    
    // Get from store contacts if available
    const storeContacts = socket.store?.contacts || {};
    for (const [jid, contact] of Object.entries(storeContacts)) {
      if (jid.endsWith('@s.whatsapp.net') && !contacts.find(c => c.jid === jid)) {
        contacts.push({
          jid,
          phone: jid.split('@')[0],
          name: contact?.name || contact?.notify || null,
          source: 'contacts',
        });
      }
    }

    // Get from chats (people we've chatted with)
    const chats = socket.store?.chats || new Map();
    for (const [chatId, chat] of chats) {
      if (chatId.endsWith('@s.whatsapp.net')) {
        // Check if already added
        if (!contacts.find(c => c.jid === chatId)) {
          contacts.push({
            jid: chatId,
            phone: chatId.split('@')[0],
            name: chat?.name || null,
            unreadCount: chat?.unreadCount || 0,
            source: 'chats',
          });
        }
      }
    }

    // Also get unique contacts from messages in database
    try {
      const session = await prisma.session.findFirst({ where: { name: sessionName } });
      if (session) {
        const messages = await prisma.message.findMany({
          where: { sessionId: session.id },
          select: { remoteJid: true },
          distinct: ['remoteJid'],
        });
        
        for (const msg of messages) {
          if (msg.remoteJid?.endsWith('@s.whatsapp.net')) {
            if (!contacts.find(c => c.jid === msg.remoteJid)) {
              contacts.push({
                jid: msg.remoteJid,
                phone: msg.remoteJid.split('@')[0],
                name: null,
                source: 'messages',
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignore database errors
    }

    return contacts;
  }

  /**
   * Get contact basic info
   * @param {string} sessionName - Session name
   * @param {string} jid - Contact JID
   * @returns {Promise<object>}
   */
  async getContactInfo(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    
    // Try to get from store first
    const contact = socket.store?.contacts?.[formattedJid];
    
    // Get profile picture and download locally
    let profilePictureUrl = null;
    let profilePictureLocal = null;
    try {
      profilePictureUrl = await socket.profilePictureUrl(formattedJid, 'image');
      if (profilePictureUrl) {
        // Download and save locally
        const result = await this.downloadProfilePicture(sessionName, formattedJid);
        profilePictureLocal = result.localPath;
      }
    } catch (e) {
      // No profile picture
    }

    // Get status/about
    let status = null;
    let statusSetAt = null;
    try {
      const statusResult = await socket.fetchStatus(formattedJid);
      status = statusResult?.status || null;
      statusSetAt = statusResult?.setAt || null;
    } catch (e) {
      // No status
    }

    return {
      jid: formattedJid,
      phone: formattedJid.split('@')[0],
      name: contact?.name || contact?.notify || null,
      status,
      statusSetAt,
      profilePicture: {
        url: profilePictureUrl,
        localUrl: profilePictureLocal,
      },
    };
  }

  /**
   * Check if phone number is registered on WhatsApp
   * @param {string} sessionName - Session name
   * @param {string} phone - Phone number
   * @returns {Promise<object>}
   */
  async checkIsOnWhatsApp(sessionName, phone) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    const results = await socket.onWhatsApp(formattedPhone);
    
    if (results && results.length > 0) {
      return {
        exists: results[0].exists,
        jid: results[0].jid,
      };
    }
    return { exists: false, jid: null };
  }

  /**
   * Get contact about/status info
   * @param {string} sessionName - Session name
   * @param {string} jid - Contact JID
   * @returns {Promise<object>}
   */
  async getContactAbout(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    
    try {
      const status = await socket.fetchStatus(formattedJid);
      return { jid: formattedJid, about: status?.status || null, setAt: status?.setAt };
    } catch (e) {
      return { jid: formattedJid, about: null, error: e.message };
    }
  }

  /**
   * Get contact profile picture URL
   * @param {string} sessionName - Session name
   * @param {string} jid - Contact JID
   * @returns {Promise<object>}
   */
  async getContactProfilePicture(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    
    try {
      const url = await socket.profilePictureUrl(formattedJid, 'image');
      // Download and save locally
      const result = await this.downloadProfilePicture(sessionName, formattedJid);
      return { jid: formattedJid, url, localUrl: result.localPath };
    } catch (e) {
      return { jid: formattedJid, url: null, localUrl: null };
    }
  }

  /**
   * Block a contact
   * @param {string} sessionName - Session name
   * @param {string} jid - Contact JID
   * @returns {Promise<void>}
   */
  async blockContact(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    await socket.updateBlockStatus(formattedJid, 'block');
    logger.info({ sessionName, jid: formattedJid }, 'Contact blocked');
  }

  /**
   * Unblock a contact
   * @param {string} sessionName - Session name
   * @param {string} jid - Contact JID
   * @returns {Promise<void>}
   */
  async unblockContact(sessionName, jid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    await socket.updateBlockStatus(formattedJid, 'unblock');
    logger.info({ sessionName, jid: formattedJid }, 'Contact unblocked');
  }

  /**
   * Get all LID to phone number mappings
   * @param {string} sessionName - Session name
   * @returns {Promise<object>}
   */
  async getLidMappings(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    
    // LID mappings can be in different locations depending on Baileys version
    const creds = socket.authState?.creds || {};
    
    // Try different possible locations
    const mappings = creds.lidMappings 
      || creds.accountSyncTimestamp 
      || {};
    
    // Also check if there's a me.lid
    const myLid = creds.me?.lid || socket.user?.lid || null;
    
    // Log available creds keys for debugging
    logger.info({ 
      sessionName, 
      credsKeys: Object.keys(creds),
      hasLid: !!myLid,
      myLid
    }, 'LID info');
    
    return {
      mappings,
      myLid,
      available: Object.keys(creds),
    };
  }

  /**
   * Get number of known LIDs
   * @param {string} sessionName - Session name
   * @returns {Promise<number>}
   */
  async getLidCount(sessionName) {
    const mappings = await this.getLidMappings(sessionName);
    return Object.keys(mappings).length;
  }

  /**
   * Get phone number by LID
   * @param {string} sessionName - Session name
   * @param {string} lid - LID
   * @returns {Promise<string|null>}
   */
  async getPhoneByLid(sessionName, lid) {
    const mappings = await this.getLidMappings(sessionName);
    return mappings[lid] || null;
  }

  /**
   * Get LID by phone number
   * @param {string} sessionName - Session name
   * @param {string} phone - Phone number
   * @returns {Promise<string|null>}
   */
  async getLidByPhone(sessionName, phone) {
    const mappings = await this.getLidMappings(sessionName);
    const formattedPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    
    for (const [lid, jid] of Object.entries(mappings)) {
      if (jid === formattedPhone || jid === phone) {
        return lid;
      }
    }
    return null;
  }

  // ==================== CHANNEL/NEWSLETTER METHODS ====================

  /**
   * Get list of subscribed channels/newsletters
   * @param {string} sessionName - Session name
   * @returns {Promise<Array>}
   */
  async getChannels(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Subscribe to newsletter updates to get list
    try {
      await socket.subscribeNewsletterUpdates([]);
    } catch (e) {
      // Ignore if already subscribed
    }

    // Get from store if available
    const newsletters = socket.store?.newsletters || {};
    const channels = Object.values(newsletters).map(nl => ({
      id: nl.id,
      name: nl.name,
      description: nl.description,
      picture: nl.picture,
      subscribers: nl.subscribers,
      createdAt: nl.creation_time,
      state: nl.state,
    }));

    return channels;
  }

  /**
   * Create a new channel/newsletter
   * @param {string} sessionName - Session name
   * @param {string} name - Channel name
   * @param {string} description - Channel description (optional)
   * @returns {Promise<object>}
   */
  async createChannel(sessionName, name, description = '') {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    try {
      const result = await socket.newsletterCreate(name, description);
      if (!result || !result.id) {
        throw new Error('Channel creation failed - WhatsApp may not support channels for this account');
      }
      logger.info({ sessionName, name, channelId: result?.id }, 'Channel created');
      return result;
    } catch (error) {
      if (error.message.includes('null') || error.message.includes('id')) {
        throw new Error('Channel creation not supported for this WhatsApp account. You may need a verified or business account.');
      }
      throw error;
    }
  }

  /**
   * Delete a channel/newsletter
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID
   * @returns {Promise<void>}
   */
  async deleteChannel(sessionName, channelJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.newsletterDelete(channelJid);
    logger.info({ sessionName, channelJid }, 'Channel deleted');
  }

  /**
   * Get channel info/metadata
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID or invite code
   * @param {string} type - 'jid' or 'invite'
   * @returns {Promise<object>}
   */
  async getChannelInfo(sessionName, channelJid, type = 'jid') {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const metadata = await socket.newsletterMetadata(type, channelJid);
    return metadata;
  }

  /**
   * Get channel messages (preview)
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID
   * @param {number} count - Number of messages to fetch
   * @returns {Promise<Array>}
   */
  async getChannelMessages(sessionName, channelJid, count = 50) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const messages = await socket.newsletterFetchMessages(channelJid, count, 0, 0);
    return messages;
  }

  /**
   * Follow a channel/newsletter
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID
   * @returns {Promise<void>}
   */
  async followChannel(sessionName, channelJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.newsletterFollow(channelJid);
    logger.info({ sessionName, channelJid }, 'Channel followed');
  }

  /**
   * Unfollow a channel/newsletter
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID
   * @returns {Promise<void>}
   */
  async unfollowChannel(sessionName, channelJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.newsletterUnfollow(channelJid);
    logger.info({ sessionName, channelJid }, 'Channel unfollowed');
  }

  /**
   * Mute a channel/newsletter
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID
   * @returns {Promise<void>}
   */
  async muteChannel(sessionName, channelJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.newsletterMute(channelJid);
    logger.info({ sessionName, channelJid }, 'Channel muted');
  }

  /**
   * Unmute a channel/newsletter
   * @param {string} sessionName - Session name
   * @param {string} channelJid - Channel JID
   * @returns {Promise<void>}
   */
  async unmuteChannel(sessionName, channelJid) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    await socket.newsletterUnmute(channelJid);
    logger.info({ sessionName, channelJid }, 'Channel unmuted');
  }

  // ==================== STATUS/STORIES METHODS ====================

  /**
   * Generate a new message ID for status (useful for batch contacts)
   * @param {string} sessionName - Session name
   * @returns {Promise<string>}
   */
  async generateStatusMessageId(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }
    
    // Generate a random message ID similar to WhatsApp format
    const id = socket.generateMessageTag();
    return id;
  }

  /**
   * Send text status/story
   * @param {string} sessionName - Session name
   * @param {string} text - Status text
   * @param {object} options - { backgroundColor, font, contacts, messageId }
   * @returns {Promise<object>}
   */
  async sendTextStatus(sessionName, text, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const { backgroundColor = '#000000', font = 0, contacts, messageId } = options;
    const statusJid = 'status@broadcast';
    
    const messageOptions = {};
    if (contacts && contacts.length > 0) {
      messageOptions.statusJidList = contacts.map(c => 
        c.includes('@') ? c : `${c}@s.whatsapp.net`
      );
    }
    if (messageId) {
      messageOptions.messageId = messageId;
    }

    const result = await socket.sendMessage(statusJid, {
      text,
      backgroundColor,
      font,
    }, messageOptions);

    await cacheService.setMessage(sessionName, result.key.id, result);
    logger.info({ sessionName, statusId: result.key.id }, 'Text status sent');
    return result;
  }

  /**
   * Send image status/story
   * @param {string} sessionName - Session name
   * @param {string} imageUrl - Image URL or base64
   * @param {object} options - { caption, contacts, messageId }
   * @returns {Promise<object>}
   */
  async sendImageStatus(sessionName, imageUrl, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const { caption, contacts, messageId } = options;
    const statusJid = 'status@broadcast';
    
    const messageOptions = {};
    if (contacts && contacts.length > 0) {
      messageOptions.statusJidList = contacts.map(c => 
        c.includes('@') ? c : `${c}@s.whatsapp.net`
      );
    }
    if (messageId) {
      messageOptions.messageId = messageId;
    }

    // Handle URL or base64
    let imageBuffer;
    if (imageUrl.startsWith('http')) {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      imageBuffer = Buffer.from(imageUrl, 'base64');
    }

    const result = await socket.sendMessage(statusJid, {
      image: imageBuffer,
      caption,
    }, messageOptions);

    await cacheService.setMessage(sessionName, result.key.id, result);
    logger.info({ sessionName, statusId: result.key.id }, 'Image status sent');
    return result;
  }

  /**
   * Send video status/story
   * @param {string} sessionName - Session name
   * @param {string} videoUrl - Video URL or base64
   * @param {object} options - { caption, contacts, messageId }
   * @returns {Promise<object>}
   */
  async sendVideoStatus(sessionName, videoUrl, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const { caption, contacts, messageId } = options;
    const statusJid = 'status@broadcast';
    
    const messageOptions = {};
    if (contacts && contacts.length > 0) {
      messageOptions.statusJidList = contacts.map(c => 
        c.includes('@') ? c : `${c}@s.whatsapp.net`
      );
    }
    if (messageId) {
      messageOptions.messageId = messageId;
    }

    // Handle URL or base64
    let videoBuffer;
    if (videoUrl.startsWith('http')) {
      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      videoBuffer = Buffer.from(response.data);
    } else if (videoUrl.startsWith('data:')) {
      const base64Data = videoUrl.split(',')[1];
      videoBuffer = Buffer.from(base64Data, 'base64');
    } else {
      videoBuffer = Buffer.from(videoUrl, 'base64');
    }

    const result = await socket.sendMessage(statusJid, {
      video: videoBuffer,
      caption,
    }, messageOptions);

    await cacheService.setMessage(sessionName, result.key.id, result);
    logger.info({ sessionName, statusId: result.key.id }, 'Video status sent');
    return result;
  }

  /**
   * Send voice status/story
   * @param {string} sessionName - Session name
   * @param {string} audioUrl - Audio URL or base64
   * @param {object} options - { contacts, messageId }
   * @returns {Promise<object>}
   */
  async sendVoiceStatus(sessionName, audioUrl, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const { contacts, messageId } = options;
    const statusJid = 'status@broadcast';
    
    const messageOptions = {};
    if (contacts && contacts.length > 0) {
      messageOptions.statusJidList = contacts.map(c => 
        c.includes('@') ? c : `${c}@s.whatsapp.net`
      );
    }
    if (messageId) {
      messageOptions.messageId = messageId;
    }

    // Handle URL or base64
    let audioBuffer;
    if (audioUrl.startsWith('http')) {
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      audioBuffer = Buffer.from(response.data);
    } else if (audioUrl.startsWith('data:')) {
      const base64Data = audioUrl.split(',')[1];
      audioBuffer = Buffer.from(base64Data, 'base64');
    } else {
      audioBuffer = Buffer.from(audioUrl, 'base64');
    }

    const result = await socket.sendMessage(statusJid, {
      audio: audioBuffer,
      ptt: true,
      mimetype: 'audio/ogg; codecs=opus',
    }, messageOptions);

    await cacheService.setMessage(sessionName, result.key.id, result);
    logger.info({ sessionName, statusId: result.key.id }, 'Voice status sent');
    return result;
  }

  /**
   * Delete a sent status
   * @param {string} sessionName - Session name
   * @param {string} statusId - Status message ID
   * @returns {Promise<void>}
   */
  async deleteStatus(sessionName, statusId) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const statusJid = 'status@broadcast';
    
    await socket.sendMessage(statusJid, {
      delete: {
        remoteJid: statusJid,
        fromMe: true,
        id: statusId,
      },
    });

    logger.info({ sessionName, statusId }, 'Status deleted');
  }

  // ==================== PRESENCE METHODS ====================

  /**
   * Set session presence (online/offline/typing/recording/paused)
   * @param {string} sessionName - Session name
   * @param {string} presence - Presence status
   * @param {string} chatId - Chat JID (required for typing/recording/paused)
   * @returns {Promise<void>}
   */
  async setPresence(sessionName, presence, chatId = null) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const validPresences = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    // Map common names to baileys names
    const presenceMap = {
      'online': 'available',
      'offline': 'unavailable',
      'typing': 'composing',
    };
    
    const mappedPresence = presenceMap[presence] || presence;
    
    if (!validPresences.includes(mappedPresence)) {
      throw new Error(`Invalid presence. Must be one of: online, offline, typing, recording, paused`);
    }

    // For typing/recording/paused, chatId is required
    if (['composing', 'recording', 'paused'].includes(mappedPresence) && !chatId) {
      throw new Error('chatId is required for typing/recording/paused presence');
    }

    if (chatId) {
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      await socket.sendPresenceUpdate(mappedPresence, jid);
    } else {
      await socket.sendPresenceUpdate(mappedPresence);
    }

    logger.info({ sessionName, presence: mappedPresence, chatId }, 'Presence set');
  }

  /**
   * Get all subscribed presence information
   * @param {string} sessionName - Session name
   * @returns {Promise<Array>}
   */
  async getAllPresences(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const presences = socket.store?.presences || {};
    const result = [];

    for (const [jid, data] of Object.entries(presences)) {
      result.push({
        id: jid,
        presences: Object.entries(data).map(([participant, info]) => ({
          participant,
          lastKnownPresence: info.lastKnownPresence,
          lastSeen: info.lastSeen || null,
        })),
      });
    }

    return result;
  }

  /**
   * Get presence for a specific chat (also subscribes if not subscribed)
   * @param {string} sessionName - Session name
   * @param {string} chatId - Chat JID
   * @returns {Promise<object>}
   */
  async getPresence(sessionName, chatId) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;

    // Subscribe to presence if not already
    try {
      await socket.presenceSubscribe(jid);
    } catch (e) {
      // Already subscribed or error
    }

    // Get from store
    const presenceData = socket.store?.presences?.[jid] || {};
    
    return {
      id: jid,
      presences: Object.entries(presenceData).map(([participant, info]) => ({
        participant,
        lastKnownPresence: info.lastKnownPresence || 'unknown',
        lastSeen: info.lastSeen || null,
      })),
    };
  }

  /**
   * Subscribe to presence updates for a chat
   * @param {string} sessionName - Session name
   * @param {string} chatId - Chat JID
   * @returns {Promise<void>}
   */
  async subscribePresence(sessionName, chatId) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    await socket.presenceSubscribe(jid);
    logger.info({ sessionName, chatId: jid }, 'Subscribed to presence');
  }

  // ==================== LABELS METHODS (Business Only) ====================

  /**
   * Get all labels (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @returns {Promise<Array>}
   */
  async getLabels(sessionName) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const labels = socket.store?.labels || {};
    return Object.values(labels).map(label => ({
      id: label.id,
      name: label.name,
      color: label.color,
      colorHex: this.getLabelColorHex(label.color),
    }));
  }

  /**
   * Helper to convert color number to hex
   */
  getLabelColorHex(colorNum) {
    const colors = {
      0: '#00a884', // Default/green
      1: '#64c4ff', // Blue
      2: '#ffd429', // Yellow
      3: '#ff9a3e', // Orange
      4: '#ff6b6b', // Red
      5: '#a78bfa', // Purple
      6: '#f472b6', // Pink
      7: '#6ee7b7', // Teal
    };
    return colors[colorNum] || '#808080';
  }

  /**
   * Create a new label (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @param {string} name - Label name
   * @param {number} color - Label color (0-7)
   * @returns {Promise<object>}
   */
  async createLabel(sessionName, name, color = 0) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const result = await socket.addLabel(name, color);
    logger.info({ sessionName, name, color }, 'Label created');
    return result;
  }

  /**
   * Update a label (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @param {string} labelId - Label ID
   * @param {string} name - New label name
   * @param {number} color - New label color
   * @returns {Promise<void>}
   */
  async updateLabel(sessionName, labelId, name, color) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Baileys doesn't have direct updateLabel, use appPatch
    await socket.addLabel(name, color); // This may update or create
    logger.info({ sessionName, labelId, name, color }, 'Label updated');
  }

  /**
   * Delete a label (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @param {string} labelId - Label ID
   * @returns {Promise<void>}
   */
  async deleteLabel(sessionName, labelId) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    // Use chatModify to remove label associations, then delete
    await socket.addLabel('', 0); // Placeholder - actual deletion may vary
    logger.info({ sessionName, labelId }, 'Label deleted');
  }

  /**
   * Get labels for a specific chat (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @param {string} chatId - Chat JID
   * @returns {Promise<Array>}
   */
  async getLabelsForChat(sessionName, chatId) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    const chat = socket.store?.chats?.[jid];
    const labelIds = chat?.labels || [];
    const allLabels = socket.store?.labels || {};

    return labelIds.map(id => {
      const label = allLabels[id];
      return label ? {
        id: label.id,
        name: label.name,
        color: label.color,
        colorHex: this.getLabelColorHex(label.color),
      } : { id };
    });
  }

  /**
   * Set labels for a chat (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @param {string} chatId - Chat JID
   * @param {Array} labelIds - Array of label IDs to set
   * @returns {Promise<void>}
   */
  async setLabelsForChat(sessionName, chatId, labelIds) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    
    // Add labels to chat
    for (const labelId of labelIds) {
      await socket.addChatLabel(jid, labelId);
    }
    
    logger.info({ sessionName, chatId: jid, labelIds }, 'Labels set for chat');
  }

  /**
   * Get chats by label (WhatsApp Business only)
   * @param {string} sessionName - Session name
   * @param {string} labelId - Label ID
   * @returns {Promise<Array>}
   */
  async getChatsByLabel(sessionName, labelId) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const chats = socket.store?.chats || {};
    const result = [];

    for (const [jid, chat] of Object.entries(chats)) {
      if (chat.labels && chat.labels.includes(labelId)) {
        result.push({
          id: jid,
          name: chat.name || jid,
          labels: chat.labels,
        });
      }
    }

    return result;
  }

  // ==================== EVENT MESSAGE METHODS ====================

  /**
   * Send an event message (calendar invite)
   * @param {string} sessionName - Session name
   * @param {string} to - Recipient JID
   * @param {object} event - Event details
   * @param {object} options - { replyTo }
   * @returns {Promise<object>}
   */
  async sendEventMessage(sessionName, to, event, options = {}) {
    const socket = this.getSession(sessionName);
    if (!socket) {
      throw new Error('Session not found or not connected');
    }

    const jid = to.includes('@') ? to : formatJid(to, to.includes('-'));
    const { replyTo } = options;

    // Build event message
    const eventMessage = {
      eventMessage: {
        name: event.name,
        description: event.description || '',
        startTime: event.startTime, // Unix timestamp in seconds
        endTime: event.endTime || null,
        location: event.location ? {
          name: event.location.name || event.location,
        } : null,
        extraGuestsAllowed: event.extraGuestsAllowed || false,
        // CallType: 0 = no call, 1 = voice, 2 = video
        callType: event.callType || 0,
        joinLink: event.joinLink || null,
      },
    };

    const messageOptions = {};
    if (replyTo) {
      messageOptions.quoted = await cacheService.getMessage(sessionName, replyTo);
    }

    const result = await socket.sendMessage(jid, eventMessage, messageOptions);
    
    await cacheService.setMessage(sessionName, result.key.id, result);
    logger.info({ sessionName, to: jid, eventName: event.name }, 'Event message sent');
    
    return result;
  }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
