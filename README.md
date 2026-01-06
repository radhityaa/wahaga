# WhatsApp Gateway API

REST API untuk WhatsApp Gateway dengan multi-device support menggunakan [Baileys](https://github.com/WhiskeySockets/Baileys).

## ✨ Fitur

- 📱 **Multi-Device Support** - Kelola banyak session WhatsApp sekaligus
- 🚀 **REST API** - API lengkap untuk mengirim/menerima pesan
- 📊 **Dashboard Monitoring** - Real-time monitoring dengan React
- 🔔 **Webhooks** - Notifikasi event ke server Anda
- 💾 **Caching** - Redis untuk performa optimal
- 🔒 **Authentication** - API Key & JWT untuk keamanan
- 📚 **Swagger Docs** - Dokumentasi API interaktif
- 🐳 **Docker Ready** - Easy deployment dengan Docker

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Redis (opsional, untuk production)

### Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd whatsapp-gateway
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment**

```bash
cp .env.example .env
# Edit .env sesuai konfigurasi Anda
```

4. **Setup database**

```bash
# Buat database MySQL
mysql -u root -p -e "CREATE DATABASE whatsapp_gateway"

# Generate Prisma client & push schema
npx prisma generate
npx prisma db push
```

5. **Build dashboard** (opsional)

```bash
cd dashboard
npm install
npm run build
cd ..
```

6. **Start server**

```bash
# Development
npm run dev

# Production
npm start
```

7. **Akses aplikasi**

- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api-docs
- Dashboard: http://localhost:3000/dashboard

## 📚 API Documentation

### Authentication

Semua API endpoint memerlukan authentication menggunakan API Key:

```bash
curl -X GET http://localhost:3000/api/sessions \
  -H "X-API-Key: your-api-key"
```

### Endpoints

#### Sessions

| Method | Endpoint                    | Description         |
| ------ | --------------------------- | ------------------- |
| GET    | `/api/sessions`             | List semua sessions |
| POST   | `/api/sessions`             | Buat session baru   |
| GET    | `/api/sessions/:id`         | Detail session      |
| DELETE | `/api/sessions/:id`         | Hapus session       |
| GET    | `/api/sessions/:id/qr`      | Get QR code         |
| POST   | `/api/sessions/:id/restart` | Restart session     |

#### Messages

| Method | Endpoint                      | Description      |
| ------ | ----------------------------- | ---------------- |
| POST   | `/api/messages/send`          | Kirim pesan teks |
| POST   | `/api/messages/send-media`    | Kirim media      |
| POST   | `/api/messages/send-location` | Kirim lokasi     |
| POST   | `/api/messages/send-contact`  | Kirim contact    |

#### Groups

| Method | Endpoint                      | Description        |
| ------ | ----------------------------- | ------------------ |
| GET    | `/api/groups/:sessionId`      | List groups        |
| POST   | `/api/groups/create`          | Buat group         |
| POST   | `/api/groups/:groupId/add`    | Tambah participant |
| POST   | `/api/groups/:groupId/remove` | Hapus participant  |

#### Webhooks

| Method | Endpoint            | Description    |
| ------ | ------------------- | -------------- |
| GET    | `/api/webhooks`     | List webhooks  |
| POST   | `/api/webhooks`     | Buat webhook   |
| PUT    | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Hapus webhook  |

### Contoh Penggunaan

#### Kirim Pesan Teks

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session",
    "to": "628123456789",
    "text": "Hello World!"
  }'
```

#### Kirim Gambar

```bash
curl -X POST http://localhost:3000/api/messages/send-media \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session",
    "to": "628123456789",
    "type": "image",
    "mediaUrl": "https://example.com/image.jpg",
    "caption": "Check this out!"
  }'
```

## 🐳 Docker Deployment

### Quick Start dengan Docker Run

Database sudah built-in (SQLite) - tidak perlu setup database!

```bash
docker run -d --name whatsapp-gateway \
  -e API_KEY=your-api-key \
  -v whatsapp_data:/app/data \
  -p 3000:3000 \
  whatsapp-gateway
```

### Full Configuration

```bash
docker run -d --name whatsapp-gateway \
  -e API_KEY=your-api-key \
  -e SWAGGER_ENABLED=true \
  -e SWAGGER_USERNAME=admin \
  -e SWAGGER_PASSWORD=your_password \
  -e DASHBOARD_ENABLED=true \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD=your_password \
  -e WEBHOOK_URL=https://your-server.com/webhook \
  -e WEBHOOK_EVENTS=* \
  -v whatsapp_data:/app/data \
  -p 3000:3000 \
  whatsapp-gateway
```

### Quick Start dengan Docker Compose

```bash
# 1. (Optional) Copy environment config
cp .env.docker .env

# 2. Start services
docker compose up -d

# 3. Lihat logs
docker compose logs -f whatsapp-gateway
```

### Services yang Tersedia

| Service   | URL                             | Description           |
| --------- | ------------------------------- | --------------------- |
| API       | http://localhost:3000           | WhatsApp Gateway API  |
| Dashboard | http://localhost:3000/dashboard | Management Dashboard  |
| API Docs  | http://localhost:3000/api-docs  | Swagger Documentation |

### Docker Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart specific service
docker compose restart whatsapp-gateway

# View logs
docker compose logs -f

# Rebuild and restart
docker compose up -d --build
```

> 📖 **Untuk dokumentasi Docker lengkap, lihat [DOCKER.md](./DOCKER.md)**

### Environment Variables (Docker)

| Variable        | Description           | Default                |
| --------------- | --------------------- | ---------------------- |
| NODE_ENV        | Environment mode      | development            |
| PORT            | Server port           | 3000                   |
| DATABASE_URL    | MySQL connection URL  | -                      |
| REDIS_URL       | Redis connection URL  | redis://localhost:6379 |
| JWT_SECRET      | JWT secret key        | -                      |
| API_KEY         | Master API key        | -                      |
| WA_MAX_SESSIONS | Max WhatsApp sessions | 20                     |

## 🖥️ Manual VPS Deployment

### 1. Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server

# Install PM2
sudo npm install -g pm2
```

### 2. Setup Database

```bash
sudo mysql -u root -p

CREATE DATABASE whatsapp_gateway;
CREATE USER 'wagateway'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON whatsapp_gateway.* TO 'wagateway'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Deploy Application

```bash
# Clone repository
cd /var/www
git clone <repository-url> whatsapp-gateway
cd whatsapp-gateway

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env  # Edit konfigurasi

# Setup database
npx prisma generate
npx prisma db push

# Build dashboard
cd dashboard && npm install && npm run build && cd ..

# Start dengan PM2
pm2 start src/app.js --name whatsapp-gateway
pm2 save
pm2 startup
```

### 4. Setup Nginx (optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. SSL Certificate

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🔔 Webhook Events

Webhook akan mengirim POST request dengan payload berikut:

```json
{
  "event": "message.received",
  "session": "my-session",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "message": { ... }
  }
}
```

### Event Types

- `message.received` - Pesan masuk
- `message.sent` - Pesan terkirim
- `message.update` - Update status pesan
- `connection.open` - Session terhubung
- `connection.close` - Session terputus
- `qr` - QR code generated
- `group.upsert` - Group baru
- `group.update` - Update group
- `group.participants` - Perubahan participant

## 🔒 Security

- Semua API request memerlukan authentication
- Rate limiting untuk mencegah abuse
- Webhook signature verification
- JWT untuk dashboard authentication

## 📝 License

MIT License

## ⚠️ Disclaimer

Proyek ini menggunakan Baileys yang merupakan implementasi tidak resmi WhatsApp Web API. Penggunaan mungkin melanggar Terms of Service WhatsApp. Gunakan dengan bijak dan risiko ditanggung sendiri.
