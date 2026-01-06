# =================================
# WhatsApp Gateway - Docker Setup Script (Windows)
# =================================
# Usage: .\scripts\docker-setup.ps1 [command]
# Commands: setup, start, stop, restart, logs, migrate, backup, status, clean
# =================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$ServiceName = ""
)

# Colors
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "→ $Message" -ForegroundColor Cyan }

function Print-Header {
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Blue
    Write-Host "  WhatsApp Gateway - Docker Management" -ForegroundColor Blue
    Write-Host "=================================================" -ForegroundColor Blue
    Write-Host ""
}

# Check Docker
function Check-Docker {
    try {
        docker --version | Out-Null
        docker compose version | Out-Null
        Write-Success "Docker and Docker Compose are installed"
        return $true
    }
    catch {
        Write-Error "Docker is not installed or not running"
        Write-Host "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
        return $false
    }
}

# Setup
function Setup {
    Print-Header
    Write-Host "Setting up WhatsApp Gateway..."
    
    if (-not (Check-Docker)) { exit 1 }
    
    # Check .env
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.docker") {
            Copy-Item ".env.docker" ".env"
            Write-Success "Created .env from .env.docker template"
            Write-Warning "Please edit .env and change default passwords before continuing!"
            Write-Host ""
            Write-Host "Open .env in your editor and modify the passwords, then run this script again."
            exit 0
        }
        else {
            Write-Error ".env.docker template not found!"
            exit 1
        }
    }
    else {
        Write-Success ".env file exists"
    }
    
    # Build images
    Write-Host ""
    Write-Info "Building Docker images..."
    docker compose build
    Write-Success "Docker images built"
    
    # Start services
    Write-Host ""
    Write-Info "Starting services..."
    docker compose up -d
    Write-Success "Services started"
    
    # Wait for database
    Write-Host ""
    Write-Info "Waiting for database (30 seconds)..."
    Start-Sleep -Seconds 30
    
    # Run migrations
    Write-Host ""
    Write-Info "Running database migrations..."
    docker exec whatsapp-gateway npx prisma migrate deploy
    Write-Success "Migrations completed"
    
    # Show result
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "  Setup Complete!" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your application:"
    Write-Host "  - API:        http://localhost:3000"
    Write-Host "  - Dashboard:  http://localhost:3000/dashboard"
    Write-Host "  - API Docs:   http://localhost:3000/api-docs"
    Write-Host ""
    Write-Host "To view logs: docker compose logs -f"
}

# Start
function Start-Services {
    Print-Header
    Write-Info "Starting services..."
    docker compose up -d
    Write-Success "Services started"
    docker compose ps
}

# Stop
function Stop-Services {
    Print-Header
    Write-Info "Stopping services..."
    docker compose down
    Write-Success "Services stopped"
}

# Restart
function Restart-Services {
    Print-Header
    Write-Info "Restarting services..."
    docker compose restart
    Write-Success "Services restarted"
}

# Logs
function Show-Logs {
    if ($ServiceName) {
        docker compose logs -f $ServiceName
    }
    else {
        docker compose logs -f
    }
}

# Migrate
function Run-Migrate {
    Print-Header
    Write-Info "Running database migrations..."
    docker exec -it whatsapp-gateway npx prisma migrate deploy
    Write-Success "Migrations completed"
}

# Backup
function Run-Backup {
    Print-Header
    $BackupDir = ".\backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    Write-Info "Backing up data to $BackupDir..."
    
    # Backup MySQL
    Write-Info "Backing up database..."
    docker compose exec -T mysql mysqldump -u root -p"$env:MYSQL_ROOT_PASSWORD" whatsapp_gateway | Out-File "$BackupDir\database.sql" -Encoding UTF8
    Write-Success "Database backup completed"
    
    # Backup sessions
    Write-Info "Backing up sessions..."
    docker cp whatsapp-gateway:/app/storage/sessions "$BackupDir\sessions"
    Write-Success "Sessions backup completed"
    
    Write-Success "Backup completed: $BackupDir"
}

# Status
function Show-Status {
    Print-Header
    docker compose ps
    Write-Host ""
    Write-Info "Health check:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
        Write-Host ($response | ConvertTo-Json -Depth 10)
    }
    catch {
        Write-Warning "API not responding"
    }
}

# Clean
function Run-Clean {
    Print-Header
    Write-Warning "This will remove all containers, volumes, and images!"
    $confirm = Read-Host "Are you sure? (y/N)"
    
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        docker compose down -v --rmi all
        Write-Success "Cleanup completed"
    }
    else {
        Write-Host "Cancelled"
    }
}

# Help
function Show-Help {
    Print-Header
    Write-Host "Usage: .\scripts\docker-setup.ps1 [command] [options]"
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  setup    - Initial setup (build, start, migrate)"
    Write-Host "  start    - Start all services"
    Write-Host "  stop     - Stop all services"
    Write-Host "  restart  - Restart all services"
    Write-Host "  logs     - Show logs (optional: service name)"
    Write-Host "  migrate  - Run database migrations"
    Write-Host "  backup   - Backup database and sessions"
    Write-Host "  status   - Show services status"
    Write-Host "  clean    - Remove all containers and volumes"
    Write-Host "  help     - Show this help"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\docker-setup.ps1 setup"
    Write-Host "  .\scripts\docker-setup.ps1 logs whatsapp-gateway"
    Write-Host ""
}

# Main
switch ($Command.ToLower()) {
    "setup" { Setup }
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "logs" { Show-Logs }
    "migrate" { Run-Migrate }
    "backup" { Run-Backup }
    "status" { Show-Status }
    "clean" { Run-Clean }
    default { Show-Help }
}
