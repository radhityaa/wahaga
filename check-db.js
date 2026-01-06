const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const sessions = await p.session.findMany();
  console.log('Sessions:');
  sessions.forEach(s => console.log('  -', s.id, s.name));
  
  const messages = await p.message.findMany({ take: 5 });
  console.log('\nMessages count:', messages.length);
  messages.forEach(m => console.log('  -', m.sessionId, m.remoteJid?.substring(0, 30)));
  
  await p.$disconnect();
}

check();
