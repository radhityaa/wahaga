const http = require('http');

const data = JSON.stringify({
  messageKey: {
    id: "B0ED22A4D92E8CF1BD098D19E19A3D2D",
    remoteJid: "628969994093267@s.whatsapp.net",
    fromMe: false
  },
  star: true
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/messages/wa1/star',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'dev-master-api-key-12345',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
