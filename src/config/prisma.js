const { PrismaClient } = require('@prisma/client');

// Prisma Singleton - prevents "Too many database connections" error
// by reusing a single PrismaClient instance across the application

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // In development, use a global variable to preserve the value
  // across module reloads caused by HMR (Hot Module Replacement)
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
