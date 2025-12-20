const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Gateway API',
      version: '1.0.0',
      description: 'REST API for WhatsApp Gateway with multi-device support using Baileys',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for authentication (set in .env as API_KEY)',
        },
      },
      schemas: {
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['connected', 'disconnected', 'connecting', 'qr'] 
            },
            phone: { type: 'string' },
            pushName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sessionId: { type: 'string' },
            messageId: { type: 'string' },
            remoteJid: { type: 'string' },
            fromMe: { type: 'boolean' },
            type: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SendMessageRequest: {
          type: 'object',
          required: ['sessionId', 'to', 'text'],
          properties: {
            sessionId: { type: 'string', description: 'Session name or ID' },
            to: { type: 'string', description: 'Recipient phone number (e.g., 628123456789)' },
            text: { type: 'string', description: 'Message text' },
          },
        },
        SendMediaRequest: {
          type: 'object',
          required: ['sessionId', 'to', 'mediaUrl', 'type'],
          properties: {
            sessionId: { type: 'string' },
            to: { type: 'string' },
            mediaUrl: { type: 'string', description: 'URL or local path to media file' },
            type: { 
              type: 'string', 
              enum: ['image', 'video', 'audio', 'document'] 
            },
            caption: { type: 'string' },
            filename: { type: 'string' },
          },
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sessionId: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            events: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            isActive: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing API key',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        BadRequest: {
          description: 'Bad request - Invalid input',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    security: [
      { ApiKeyAuth: [] },
    ],
    tags: [
      { name: 'Sessions', description: 'WhatsApp session management' },
      { name: 'Profile', description: 'Profile management (name, status, picture)' },
      { name: 'Contacts', description: 'Contact management and LID mappings' },
      { name: 'Messages', description: 'Send and receive messages' },
      { name: 'Groups', description: 'Group management' },
      { name: 'Channels', description: 'WhatsApp Channels/Newsletter management' },
      { name: 'Status', description: 'WhatsApp Status/Stories' },
      { name: 'Presence', description: 'Online/offline/typing status' },
      { name: 'Labels', description: 'WhatsApp Labels (Business only)' },
      { name: 'Events', description: 'Event Messages (calendar invites)' },
      { name: 'Webhooks', description: 'Webhook configuration' },
      { name: 'Dashboard', description: 'Dashboard data endpoints' },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
