# 🐳 Docker Deployment Guide

Complete guide to deploy WhatsApp Gateway using Docker.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Docker Compose](#docker-compose)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)
- [Production Deployment](#production-deployment)
- [Persistent Storage](#persistent-storage)
- [Backup & Restore](#backup--restore)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Simplest Run (One Command!)

Database is **built-in** (SQLite) - no external database setup needed!

```bash
docker run -d --name whatsapp-gateway \
  -e API_KEY=your-secret-api-key \
  -v whatsapp_data:/app/data \
  -p 3000:3000 \
  whatsapp-gateway
```

**That's it!** Access your application:

| Service   | URL                             |
| --------- | ------------------------------- |
| API       | http://localhost:3000           |
| Dashboard | http://localhost:3000/dashboard |
| API Docs  | http://localhost:3000/api-docs  |

### Full Configuration

```bash
docker run -d --name whatsapp-gateway \
  -e SWAGGER_ENABLED=true \
  -e SWAGGER_USERNAME=admin \
  -e SWAGGER_PASSWORD=your_swagger_password \
  -e DASHBOARD_ENABLED=true \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD=your_dashboard_password \
  -e API_KEY=your-api-key \
  -e WEBHOOK_URL=https://your-server.com/webhook \
  -e WEBHOOK_EVENTS=* \
  -e WA_MAX_SESSIONS=20 \
  -v whatsapp_data:/app/data \
  -v whatsapp_sessions:/app/storage/sessions \
  -p 3000:3000 \
  whatsapp-gateway
```

---

## Docker Compose

For production deployment with Redis caching:

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-repo/whatsapp-gateway.git
cd whatsapp-gateway

# 2. (Optional) Create .env file
cp .env.docker .env
nano .env  # Edit if needed

# 3. Start services
docker compose up -d

# 4. View logs
docker compose logs -f
```

### What's Included

| Service          | Port | Description      |
| ---------------- | ---- | ---------------- |
| whatsapp-gateway | 3000 | API + Dashboard  |
| redis            | 6379 | Cache (optional) |

> **Note:** Database is built-in (SQLite). No MySQL setup required!

### Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f whatsapp-gateway

# Restart
docker compose restart whatsapp-gateway

# Rebuild
docker compose up -d --build
```

---

## Environment Variables

### Core Settings

| Variable    | Default    | Description                       |
| ----------- | ---------- | --------------------------------- |
| `PORT`      | 3000       | API server port                   |
| `NODE_ENV`  | production | Environment mode                  |
| `LOG_LEVEL` | info       | Log level (debug/info/warn/error) |

### API Security

| Variable  | Default | Description            |
| --------- | ------- | ---------------------- |
| `API_KEY` | -       | API authentication key |

Supports plain text or SHA512 hash:

```bash
# Plain text
-e API_KEY=my-secret-key

# SHA512 hash (more secure)
-e API_KEY=sha512:your-sha512-hash-here
```

Generate SHA512 hash:

```bash
echo -n "your-key" | sha512sum
```

### Swagger Documentation

| Variable           | Default | Description         |
| ------------------ | ------- | ------------------- |
| `SWAGGER_ENABLED`  | true    | Enable Swagger UI   |
| `SWAGGER_USERNAME` | -       | Basic auth username |
| `SWAGGER_PASSWORD` | -       | Basic auth password |

### Dashboard

| Variable             | Default | Description        |
| -------------------- | ------- | ------------------ |
| `DASHBOARD_ENABLED`  | true    | Enable dashboard   |
| `DASHBOARD_USERNAME` | -       | Dashboard username |
| `DASHBOARD_PASSWORD` | -       | Dashboard password |

### Default Webhook

| Variable         | Default | Description               |
| ---------------- | ------- | ------------------------- |
| `WEBHOOK_URL`    | -       | Default webhook URL       |
| `WEBHOOK_EVENTS` | \*      | Events to send (\* = all) |

### WhatsApp Settings

| Variable          | Default | Description               |
| ----------------- | ------- | ------------------------- |
| `WA_MAX_SESSIONS` | 20      | Maximum WhatsApp sessions |

### External Database (Optional)

By default, the gateway uses built-in SQLite. To use external MySQL:

| Variable       | Default  | Description          |
| -------------- | -------- | -------------------- |
| `DATABASE_URL` | (SQLite) | MySQL connection URL |

Example: `mysql://user:password@host:3306/database`

### Redis (Optional)

| Variable    | Default | Description          |
| ----------- | ------- | -------------------- |
| `REDIS_URL` | -       | Redis connection URL |

Example: `redis://localhost:6379`

---

## Configuration Examples

### Minimal (Just API Key)

```bash
docker run -d --name wa-gateway \
  -e API_KEY=my-secret-key \
  -p 3000:3000 \
  whatsapp-gateway
```

### With Authentication

```bash
docker run -d --name wa-gateway \
  -e API_KEY=my-secret-key \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD=secure-password \
  -e SWAGGER_USERNAME=admin \
  -e SWAGGER_PASSWORD=secure-password \
  -p 3000:3000 \
  whatsapp-gateway
```

### With Webhook

```bash
docker run -d --name wa-gateway \
  -e API_KEY=my-key \
  -e WEBHOOK_URL=https://your-server.com/webhook \
  -e WEBHOOK_EVENTS=message,session.status \
  -p 3000:3000 \
  whatsapp-gateway
```

### Production with Persistent Storage

```bash
docker run -d --name wa-gateway \
  -e API_KEY=my-secure-key \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD=strong-password \
  -e WA_MAX_SESSIONS=50 \
  -e LOG_LEVEL=warn \
  -v /data/whatsapp/data:/app/data \
  -v /data/whatsapp/sessions:/app/storage/sessions \
  -v /data/whatsapp/uploads:/app/storage/uploads \
  --restart unless-stopped \
  -p 3000:3000 \
  whatsapp-gateway
```

---

## Production Deployment

### Build the Image

```bash
# Clone repository
git clone https://github.com/your-repo/whatsapp-gateway.git
cd whatsapp-gateway

# Build image
docker build -t whatsapp-gateway:latest .

# Or with version tag
docker build -t whatsapp-gateway:1.0.0 .
```

### Push to Registry

```bash
# Tag for your registry
docker tag whatsapp-gateway:latest your-registry.com/whatsapp-gateway:latest

# Push
docker push your-registry.com/whatsapp-gateway:latest
```

### Deploy on Server

```bash
# Pull image
docker pull your-registry.com/whatsapp-gateway:latest

# Run
docker run -d --name whatsapp-gateway \
  -e API_KEY=your-production-key \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD=strong-password \
  -v whatsapp_data:/app/data \
  -v whatsapp_sessions:/app/storage/sessions \
  --restart unless-stopped \
  -p 3000:3000 \
  your-registry.com/whatsapp-gateway:latest
```

### SSL/HTTPS with Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Persistent Storage

### Volumes

| Path                    | Description            |
| ----------------------- | ---------------------- |
| `/app/data`             | SQLite database        |
| `/app/storage/sessions` | WhatsApp session files |
| `/app/storage/uploads`  | Uploaded media files   |

### Mount Volumes

```bash
docker run -d \
  -v whatsapp_data:/app/data \
  -v whatsapp_sessions:/app/storage/sessions \
  -v whatsapp_uploads:/app/storage/uploads \
  ...
```

Or use host paths:

```bash
docker run -d \
  -v /path/on/host/data:/app/data \
  -v /path/on/host/sessions:/app/storage/sessions \
  ...
```

---

## Backup & Restore

### Backup

```bash
# Backup database
docker cp whatsapp-gateway:/app/data/whatsapp.db ./backup_db_$(date +%Y%m%d).db

# Backup sessions
docker cp whatsapp-gateway:/app/storage/sessions ./backup_sessions_$(date +%Y%m%d)

# Or backup entire data volume
docker run --rm -v whatsapp_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/whatsapp_backup_$(date +%Y%m%d).tar.gz /data
```

### Restore

```bash
# Restore database
docker cp ./backup_db_20240101.db whatsapp-gateway:/app/data/whatsapp.db

# Restore sessions
docker cp ./backup_sessions_20240101/. whatsapp-gateway:/app/storage/sessions/

# Restart to apply
docker restart whatsapp-gateway
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs whatsapp-gateway

# Check if port is in use
netstat -tlnp | grep 3000
```

### Sessions not persisting

Ensure volumes are mounted:

```bash
docker run ... -v whatsapp_data:/app/data -v whatsapp_sessions:/app/storage/sessions ...
```

### Permission issues

```bash
# Fix permissions on host-mounted volumes
sudo chown -R 1001:1001 /path/to/data
```

### Reset everything

```bash
# Stop and remove container
docker stop whatsapp-gateway
docker rm whatsapp-gateway

# Remove volumes (WARNING: deletes all data!)
docker volume rm whatsapp_data whatsapp_sessions whatsapp_uploads

# Start fresh
docker run ...
```

### View real-time logs

```bash
docker logs -f whatsapp-gateway
```

---

## Quick Reference

```bash
# Start (simple)
docker run -d --name wa -e API_KEY=key -p 3000:3000 whatsapp-gateway

# Start (with compose)
docker compose up -d

# Stop
docker stop whatsapp-gateway

# View logs
docker logs -f whatsapp-gateway

# Restart
docker restart whatsapp-gateway

# Shell access
docker exec -it whatsapp-gateway sh

# Remove
docker rm -f whatsapp-gateway
```

---

## Support

- 📖 [API Documentation](http://localhost:3000/api-docs)
- 🐛 [Report Issues](https://github.com/your-repo/whatsapp-gateway/issues)
