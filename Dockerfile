# =================================
# WhatsApp Gateway - Production Dockerfile
# =================================
# 
# SIMPLE RUN (database built-in, no config needed!):
#   docker run -d --name whatsapp-gateway \
#     -e API_KEY=your-api-key \
#     -p 3000:3000 \
#     whatsapp-gateway
#
# FULL EXAMPLE:
#   docker run -d --name whatsapp-gateway \
#     -e SWAGGER_ENABLED=true \
#     -e SWAGGER_USERNAME=admin \
#     -e SWAGGER_PASSWORD=secret123 \
#     -e DASHBOARD_ENABLED=true \
#     -e DASHBOARD_USERNAME=admin \
#     -e DASHBOARD_PASSWORD=secret123 \
#     -e API_KEY=your-api-key \
#     -e WEBHOOK_URL=https://your-server.com/webhook \
#     -e WEBHOOK_EVENTS=* \
#     -v whatsapp_data:/app/data \
#     -p 3000:3000 \
#     whatsapp-gateway
#
# =================================

# Stage 1: Build Dashboard
FROM node:18-alpine AS dashboard-builder

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Stage 2: Production Image
FROM node:18-alpine AS production

LABEL maintainer="WhatsApp Gateway"
LABEL description="WhatsApp Gateway API - Multi-device support with Baileys"
LABEL version="1.0.0"

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    wget \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy SQLite schema for Docker (built-in database)
COPY prisma/schema.sqlite.prisma ./prisma/schema.prisma

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client for SQLite
RUN npx prisma generate

# Copy source code
COPY src ./src

# Copy built dashboard
COPY --from=dashboard-builder /app/dashboard/dist ./public/dashboard

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create directories
RUN mkdir -p /app/storage/sessions /app/storage/uploads /app/storage/logs /app/data

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S wagateway -u 1001 -G nodejs && \
    chown -R wagateway:nodejs /app

USER wagateway

# =================================
# Environment Variables
# =================================

# Core
ENV NODE_ENV=production
ENV PORT=3000

# Database (SQLite - Built-in, no configuration needed!)
ENV DATABASE_URL="file:/app/data/whatsapp.db"

# Redis (Optional - uses in-memory cache if not set)
ENV REDIS_URL=""

# API Security
# Supports plain text or SHA512 hash (sha512:hash)
ENV API_KEY=""

# Swagger Documentation
ENV SWAGGER_ENABLED=true
ENV SWAGGER_USERNAME=""
ENV SWAGGER_PASSWORD=""

# Dashboard
ENV DASHBOARD_ENABLED=true
ENV DASHBOARD_USERNAME=""
ENV DASHBOARD_PASSWORD=""

# Default Webhook (optional)
ENV WEBHOOK_URL=""
ENV WEBHOOK_EVENTS="*"

# WhatsApp Settings
ENV WA_MAX_SESSIONS=20
ENV WA_SESSION_DIR=/app/storage/sessions

# Upload Settings
ENV UPLOAD_DIR=/app/storage/uploads
ENV MAX_FILE_SIZE=50000000

# Webhook Settings
ENV WEBHOOK_TIMEOUT=30000
ENV WEBHOOK_RETRIES=3

# Rate Limiting
ENV RATE_LIMIT_WINDOW_MS=60000
ENV RATE_LIMIT_MAX_REQUESTS=100

# Logging
ENV LOG_LEVEL=info

# =================================

EXPOSE 3000

VOLUME ["/app/storage", "/app/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/entrypoint.sh"]
