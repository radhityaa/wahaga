# =================================
# WhatsApp Gateway - Makefile
# =================================
# Usage: make [command]
# =================================

.PHONY: help setup start stop restart logs migrate backup clean status dev build

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# Help
help:
	@echo ""
	@echo "$(BLUE)WhatsApp Gateway - Docker Commands$(NC)"
	@echo "====================================="
	@echo ""
	@echo "$(GREEN)Docker Production:$(NC)"
	@echo "  make setup     - Initial setup (build, start, migrate)"
	@echo "  make start     - Start all services"
	@echo "  make stop      - Stop all services"
	@echo "  make restart   - Restart all services"
	@echo "  make logs      - Show logs"
	@echo "  make migrate   - Run database migrations"
	@echo "  make status    - Show services status"
	@echo "  make backup    - Backup database and sessions"
	@echo "  make clean     - Remove containers and volumes"
	@echo ""
	@echo "$(GREEN)Docker Development:$(NC)"
	@echo "  make dev       - Start development environment"
	@echo "  make dev-stop  - Stop development environment"
	@echo ""
	@echo "$(GREEN)Build:$(NC)"
	@echo "  make build     - Build Docker images"
	@echo "  make rebuild   - Rebuild Docker images (no cache)"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make db-shell  - Access MySQL CLI"
	@echo "  make db-studio - Open Prisma Studio"
	@echo ""

# =================================
# Production Commands
# =================================

# Initial setup
setup:
	@echo "$(BLUE)Setting up WhatsApp Gateway...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.docker .env; \
		echo "$(YELLOW)Created .env from template. Please edit it and run 'make setup' again.$(NC)"; \
		exit 1; \
	fi
	docker compose build
	docker compose up -d
	@echo "Waiting for database..."
	@sleep 15
	docker compose exec -T whatsapp-gateway npx prisma migrate deploy
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo ""
	@echo "Access:"
	@echo "  - API:       http://localhost:3000"
	@echo "  - Dashboard: http://localhost:3000/dashboard"
	@echo "  - API Docs:  http://localhost:3000/api-docs"

# Start services
start:
	@echo "$(BLUE)Starting services...$(NC)"
	docker compose up -d
	docker compose ps

# Stop services
stop:
	@echo "$(BLUE)Stopping services...$(NC)"
	docker compose down

# Restart services
restart:
	@echo "$(BLUE)Restarting services...$(NC)"
	docker compose restart

# Show logs
logs:
	docker compose logs -f

# Show specific service logs
logs-%:
	docker compose logs -f $*

# Run migrations
migrate:
	@echo "$(BLUE)Running migrations...$(NC)"
	docker compose exec whatsapp-gateway npx prisma migrate deploy

# Show status
status:
	docker compose ps
	@echo ""
	@echo "Health check:"
	@curl -s http://localhost:3000/api/health | jq . 2>/dev/null || echo "API not responding"

# Backup
backup:
	@echo "$(BLUE)Creating backup...$(NC)"
	@mkdir -p backups
	docker compose exec -T mysql mysqldump -u root -p$${MYSQL_ROOT_PASSWORD:-whatsapp_secret} whatsapp_gateway > backups/db_$$(date +%Y%m%d_%H%M%S).sql
	docker cp whatsapp-gateway:/app/storage/sessions backups/sessions_$$(date +%Y%m%d_%H%M%S)
	@echo "$(GREEN)Backup completed$(NC)"

# Clean everything
clean:
	@echo "$(YELLOW)This will remove all containers and volumes!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ $${confirm:-N} = y ]
	docker compose down -v --rmi all

# =================================
# Development Commands
# =================================

# Start development environment
dev:
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker compose -f docker-compose.dev.yml up -d
	docker compose -f docker-compose.dev.yml ps

# Stop development environment
dev-stop:
	docker compose -f docker-compose.dev.yml down

# Development logs
dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

# =================================
# Build Commands
# =================================

# Build images
build:
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker compose build

# Rebuild without cache
rebuild:
	@echo "$(BLUE)Rebuilding Docker images...$(NC)"
	docker compose build --no-cache

# =================================
# Database Commands
# =================================

# Access MySQL shell
db-shell:
	docker compose exec mysql mysql -u root -p

# Open Prisma Studio
db-studio:
	docker compose exec whatsapp-gateway npx prisma studio

# Generate Prisma client
prisma-generate:
	docker compose exec whatsapp-gateway npx prisma generate

# =================================
# Utility Commands
# =================================

# Shell into container
shell:
	docker compose exec whatsapp-gateway sh

# Prune Docker
prune:
	docker system prune -af
	docker volume prune -f
