const os = require('os');
const whatsappService = require('../services/whatsapp.service');
const cacheService = require('../services/cache.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const prisma = require('../config/prisma');

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard statistics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
const getStats = asyncHandler(async (req, res) => {
  const [
    totalSessions,
    connectedSessions,
    totalMessages,
    todayMessages,
    totalWebhooks,
    activeWebhooks,
  ] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { status: 'connected' } }),
    prisma.message.count(),
    prisma.message.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.webhook.count(),
    prisma.webhook.count({ where: { isActive: true } }),
  ]);

  res.json({
    success: true,
    data: {
      sessions: {
        total: totalSessions,
        connected: connectedSessions,
        disconnected: totalSessions - connectedSessions,
      },
      messages: {
        total: totalMessages,
        today: todayMessages,
      },
      webhooks: {
        total: totalWebhooks,
        active: activeWebhooks,
      },
    },
  });
});

/**
 * @swagger
 * /api/dashboard/system:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get system metrics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 */
const getSystemMetrics = asyncHandler(async (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  const cacheStats = await cacheService.getStats();

  res.json({
    success: true,
    data: {
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model,
        loadAvg: os.loadavg(),
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        nodeVersion: process.version,
      },
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime),
      },
      cache: cacheStats,
      activeSessions: whatsappService.getAllSessions().length,
    },
  });
});

/**
 * @swagger
 * /api/dashboard/events:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get recent events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Recent events
 */
const getEvents = asyncHandler(async (req, res) => {
  const { sessionId, type, limit = 50 } = req.query;

  const where = {};
  if (sessionId) {
    const session = await prisma.session.findFirst({
      where: {
        OR: [
          { id: sessionId },
          { name: sessionId },
        ],
      },
    });
    if (session) where.sessionId = session.id;
  }
  if (type) where.type = type;

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
    include: {
      session: {
        select: { name: true },
      },
    },
  });

  res.json({
    success: true,
    data: events,
  });
});

/**
 * @swagger
 * /api/dashboard/events:
 *   delete:
 *     tags: [Dashboard]
 *     summary: Clear all events (logs)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Optional - only clear events for specific session
 *     responses:
 *       200:
 *         description: Events cleared successfully
 */
const clearEvents = asyncHandler(async (req, res) => {
  const { sessionId } = req.query;

  const where = {};
  if (sessionId) {
    const session = await prisma.session.findFirst({
      where: {
        OR: [
          { id: sessionId },
          { name: sessionId },
        ],
      },
    });
    if (session) where.sessionId = session.id;
  }

  const result = await prisma.event.deleteMany({ where });

  res.json({
    success: true,
    message: `Cleared ${result.count} events`,
    data: { deleted: result.count },
  });
});

/**
 * @swagger
 * /api/dashboard/messages/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get message statistics
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Message statistics
 */
const getMessageStats = asyncHandler(async (req, res) => {
  const { period = 'day' } = req.query;

  let startDate;
  let groupBy;
  
  switch (period) {
    case 'hour':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      groupBy = 'hour';
      break;
    case 'week':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
      groupBy = 'day';
      break;
    case 'month':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      groupBy = 'day';
      break;
    default:
      startDate = new Date(new Date().setHours(0, 0, 0, 0)); // Today
      groupBy = 'hour';
  }

  // Get message counts grouped by time
  const messages = await prisma.message.findMany({
    where: {
      createdAt: { gte: startDate },
    },
    select: {
      id: true,
      fromMe: true,
      type: true,
      status: true,
      createdAt: true,
    },
  });

  // Group by time period
  const grouped = {};
  messages.forEach((msg) => {
    let key;
    if (groupBy === 'hour') {
      key = msg.createdAt.toISOString().substring(0, 13) + ':00';
    } else {
      key = msg.createdAt.toISOString().substring(0, 10);
    }

    if (!grouped[key]) {
      grouped[key] = { sent: 0, received: 0, total: 0 };
    }
    grouped[key].total++;
    if (msg.fromMe) {
      grouped[key].sent++;
    } else {
      grouped[key].received++;
    }
  });

  // Convert to array and sort
  const data = Object.entries(grouped)
    .map(([time, counts]) => ({ time, ...counts }))
    .sort((a, b) => a.time.localeCompare(b.time));

  // Get type breakdown
  const byType = {};
  messages.forEach((msg) => {
    byType[msg.type] = (byType[msg.type] || 0) + 1;
  });

  // Get status breakdown
  const byStatus = {};
  messages.forEach((msg) => {
    byStatus[msg.status] = (byStatus[msg.status] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      timeline: data,
      byType,
      byStatus,
      totals: {
        sent: messages.filter((m) => m.fromMe).length,
        received: messages.filter((m) => !m.fromMe).length,
        total: messages.length,
      },
    },
  });
});

/**
 * @swagger
 * /api/dashboard/sessions/live:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get live session states
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Live session states
 */
const getLiveSessions = asyncHandler(async (req, res) => {
  const sessions = whatsappService.getAllSessions();

  res.json({
    success: true,
    data: sessions,
  });
});

/**
 * Format uptime to human readable
 * @param {number} seconds - Uptime in seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

module.exports = {
  getStats,
  getSystemMetrics,
  getEvents,
  clearEvents,
  getMessageStats,
  getLiveSessions,
};
