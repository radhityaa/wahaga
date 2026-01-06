#!/bin/bash

# =================================
# WhatsApp Gateway - Docker Setup Script
# =================================
# Usage: ./scripts/docker-setup.sh [command]
# Commands: setup, start, stop, restart, logs, migrate, backup, restore
# =================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "================================================="
    echo "  WhatsApp Gateway - Docker Management"
    echo "================================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Setup environment
setup() {
    print_header
    echo "Setting up WhatsApp Gateway..."
    echo ""
    
    check_docker
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        if [ -f ".env.docker" ]; then
            cp .env.docker .env
            print_success "Created .env from .env.docker template"
            print_warning "Please edit .env and change default passwords before continuing!"
            echo ""
            echo "Run: nano .env"
            echo ""
            exit 0
        else
            print_error ".env.docker template not found!"
            exit 1
        fi
    else
        print_success ".env file exists"
    fi
    
    # Build images
    echo ""
    echo "Building Docker images..."
    docker compose build
    print_success "Docker images built successfully"
    
    # Start services
    echo ""
    echo "Starting services..."
    docker compose up -d
    print_success "Services started"
    
    # Wait for database
    echo ""
    echo "Waiting for database to be ready..."
    sleep 10
    
    # Check if MySQL is healthy
    until docker compose exec -T mysql mysqladmin ping -h localhost --silent; do
        echo "Waiting for MySQL..."
        sleep 2
    done
    print_success "Database is ready"
    
    # Run migrations
    echo ""
    echo "Running database migrations..."
    docker compose exec -T whatsapp-gateway npx prisma migrate deploy
    print_success "Migrations completed"
    
    # Show status
    echo ""
    echo "================================================="
    echo -e "${GREEN}Setup Complete!${NC}"
    echo "================================================="
    echo ""
    echo "Access your application:"
    echo "  - API:        http://localhost:3000"
    echo "  - Dashboard:  http://localhost:3000/dashboard"
    echo "  - API Docs:   http://localhost:3000/api-docs"
    echo ""
    echo "To view logs: docker compose logs -f"
    echo ""
}

# Start services
start() {
    print_header
    echo "Starting services..."
    docker compose up -d
    print_success "Services started"
    docker compose ps
}

# Stop services
stop() {
    print_header
    echo "Stopping services..."
    docker compose down
    print_success "Services stopped"
}

# Restart services
restart() {
    print_header
    echo "Restarting services..."
    docker compose restart
    print_success "Services restarted"
}

# Show logs
logs() {
    docker compose logs -f ${2:-}
}

# Run migrations
migrate() {
    print_header
    echo "Running database migrations..."
    docker compose exec whatsapp-gateway npx prisma migrate deploy
    print_success "Migrations completed"
}

# Backup data
backup() {
    print_header
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    echo "Backing up data to $BACKUP_DIR..."
    
    # Backup MySQL
    echo "Backing up MySQL database..."
    docker compose exec -T mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" whatsapp_gateway > "$BACKUP_DIR/database.sql"
    print_success "Database backup completed"
    
    # Backup sessions
    echo "Backing up WhatsApp sessions..."
    docker cp whatsapp-gateway:/app/storage/sessions "$BACKUP_DIR/sessions"
    print_success "Sessions backup completed"
    
    # Create archive
    echo "Creating archive..."
    tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname $BACKUP_DIR)" "$(basename $BACKUP_DIR)"
    rm -rf "$BACKUP_DIR"
    print_success "Backup completed: $BACKUP_DIR.tar.gz"
}

# Clean up
clean() {
    print_header
    print_warning "This will remove all containers, volumes, and images!"
    read -p "Are you sure? (y/N) " confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        docker compose down -v --rmi all
        print_success "Cleanup completed"
    else
        echo "Cancelled"
    fi
}

# Show status
status() {
    print_header
    docker compose ps
    echo ""
    echo "Health check:"
    curl -s http://localhost:3000/api/health | jq . 2>/dev/null || echo "API not responding"
}

# Show help
show_help() {
    print_header
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup    - Initial setup (build, start, migrate)"
    echo "  start    - Start all services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  logs     - Show logs (optional: service name)"
    echo "  migrate  - Run database migrations"
    echo "  backup   - Backup database and sessions"
    echo "  status   - Show services status"
    echo "  clean    - Remove all containers and volumes"
    echo "  help     - Show this help"
    echo ""
}

# Main
case "${1:-help}" in
    setup)
        setup
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs "$@"
        ;;
    migrate)
        migrate
        ;;
    backup)
        backup
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    help|*)
        show_help
        ;;
esac
