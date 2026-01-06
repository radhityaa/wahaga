const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.logLevel,
  transport: config.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child logger with session context
const createSessionLogger = (sessionName) => {
  return logger.child({ session: sessionName });
};

module.exports = {
  logger,
  createSessionLogger,
};
