const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, query, params)
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace with validated value
    req[property] = value;
    next();
  };
};

// ============ Schemas ============

// Session schemas
const sessionSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(3)
      .max(50)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Session name can only contain letters, numbers, underscores, and hyphens',
      }),
    options: Joi.object({
      browser: Joi.array().items(Joi.string()).length(3),
    }),
  }),

  params: Joi.object({
    sessionId: Joi.string().required(),
  }),
};

// Message schemas
const messageSchemas = {
  sendText: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string()
      .pattern(/^[0-9]+$|^[0-9-]+@(s\.whatsapp\.net|g\.us)$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid phone number or JID format',
      }),
    text: Joi.string().min(1).max(65535).required(),
    quotedMessageId: Joi.string(),
    mentions: Joi.array().items(Joi.string()),
  }),

  sendMedia: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    type: Joi.string().valid('image', 'video', 'audio', 'document').required(),
    mediaUrl: Joi.string().uri().when('mediaBase64', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    mediaBase64: Joi.string().base64(),
    caption: Joi.string().max(3000),
    filename: Joi.string().max(255),
    mimetype: Joi.string(),
    ptt: Joi.boolean().default(false),
  }),

  sendLocation: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    name: Joi.string().max(255),
    address: Joi.string().max(500),
  }),

  sendContact: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    contact: Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
    }).required(),
  }),

  sendButtons: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    buttons: Joi.array()
      .items(
        Joi.object({
          id: Joi.string(),
          text: Joi.string().required(),
        })
      )
      .min(1)
      .max(3)
      .required(),
    footer: Joi.string(),
  }),
};

// Group schemas
const groupSchemas = {
  create: Joi.object({
    sessionId: Joi.string().required(),
    name: Joi.string().min(1).max(100).required(),
    participants: Joi.array().items(Joi.string()).min(1).required(),
  }),

  updateParticipants: Joi.object({
    sessionId: Joi.string().required(),
    participants: Joi.array().items(Joi.string()).min(1).required(),
  }),

  params: Joi.object({
    sessionId: Joi.string().required(),
    groupId: Joi.string(),
  }),
};

// Webhook schemas
const webhookSchemas = {
  create: Joi.object({
    url: Joi.string().uri().required(),
    sessionId: Joi.string().allow(null),
    events: Joi.array()
      .items(Joi.string())
      .default(['*']),
    headers: Joi.object().pattern(Joi.string(), Joi.string()),
    secret: Joi.string().min(16),
    isActive: Joi.boolean().default(true),
    retries: Joi.number().integer().min(0).max(10).default(3),
  }),

  update: Joi.object({
    url: Joi.string().uri(),
    sessionId: Joi.string().allow(null),
    events: Joi.array().items(Joi.string()),
    headers: Joi.object().pattern(Joi.string(), Joi.string()),
    isActive: Joi.boolean(),
    retries: Joi.number().integer().min(0).max(10),
  }),

  test: Joi.object({
    url: Joi.string().uri().required(),
    headers: Joi.object().pattern(Joi.string(), Joi.string()),
    payload: Joi.object(),
  }),
};

// Query schemas
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100),
    sort: Joi.string(),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }),
};

module.exports = {
  validate,
  sessionSchemas,
  messageSchemas,
  groupSchemas,
  webhookSchemas,
  querySchemas,
};

