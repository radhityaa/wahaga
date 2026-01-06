#!/bin/sh
# =================================
# WhatsApp Gateway - Docker Entrypoint
# =================================
# Handles database setup and application startup
# Database is built-in (SQLite) - no configuration needed
# =================================

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         WhatsApp Gateway - Starting Container             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# =================================
# Ensure data directories exist
# =================================
mkdir -p /app/data /app/storage/sessions /app/storage/uploads /app/storage/logs

# =================================
# Database Setup (SQLite - Built-in)
# =================================

echo "→ Setting up database..."

# Initialize SQLite database
npx prisma db push --accept-data-loss 2>/dev/null || echo "  Database already initialized"

echo "✓ Database ready!"

# =================================
# Setup Default Webhook (if configured)
# =================================

if [ -n "$WEBHOOK_URL" ]; then
    echo "→ Default webhook: $WEBHOOK_URL"
    echo "  Events: ${WEBHOOK_EVENTS:-*}"
fi

# =================================
# Print Configuration Summary
# =================================

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│                    Configuration                            │"
echo "├─────────────────────────────────────────────────────────────┤"
printf "│  Port:           %-42s│\n" "${PORT:-3000}"
printf "│  Dashboard:      %-42s│\n" "${DASHBOARD_ENABLED:-true}"
printf "│  Swagger:        %-42s│\n" "${SWAGGER_ENABLED:-true}"
printf "│  Max Sessions:   %-42s│\n" "${WA_MAX_SESSIONS:-20}"
printf "│  API Key:        %-42s│\n" "${API_KEY:+[CONFIGURED]}"
printf "│  Database:       %-42s│\n" "SQLite (Built-in)"

if [ -n "$WEBHOOK_URL" ]; then
printf "│  Webhook URL:    %-42s│\n" "${WEBHOOK_URL:0:40}"
fi

echo "└─────────────────────────────────────────────────────────────┘"
echo ""

# =================================
# Start Application
# =================================

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Starting Node.js Application                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "  API:        http://localhost:${PORT:-3000}"
echo "  Dashboard:  http://localhost:${PORT:-3000}/dashboard"
echo "  API Docs:   http://localhost:${PORT:-3000}/api-docs"
echo ""

exec node src/app.js
