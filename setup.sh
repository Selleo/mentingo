#!/bin/bash

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cleanup function for rollback on failure
cleanup_on_error() {
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}✗ Setup failed!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker compose down > /dev/null 2>&1 || true
    echo -e "${YELLOW}Please check the error message above and try again.${NC}"
    echo ""
}

trap cleanup_on_error ERR

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}          Mentingo Development Environment Setup           ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Detect OS
IS_WINDOWS=false
IS_MACOS=false
IS_LINUX=false

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    IS_WINDOWS=true
    echo -e "${YELLOW}Detected OS: Windows (Git Bash/MSYS)${NC}"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    IS_MACOS=true
    echo -e "${YELLOW}Detected OS: macOS${NC}"
else
    IS_LINUX=true
    echo -e "${YELLOW}Detected OS: Linux${NC}"
fi
echo ""

# Prerequisites check
echo -e "${GREEN}[0/9]${NC} Checking prerequisites..."

# Check if .tool-versions exists
if [[ ! -f ".tool-versions" ]]; then
    echo -e "${RED}✗ .tool-versions file not found!${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running!${NC}"
    echo -e "  Please start Docker and try again."
    exit 1
fi

# Check if required commands exist
for cmd in node pnpm docker openssl caddy; do
    if ! command -v $cmd > /dev/null 2>&1; then
        echo -e "${RED}✗ $cmd is not installed!${NC}"
        exit 1
    fi
done

echo -e "  ${GREEN}✓${NC} All required tools are available"
echo ""

# Version verification
echo -e "${GREEN}[1/9]${NC} Verifying tool versions..."

# Read required versions from .tool-versions
REQUIRED_NODE_VERSION=$(grep "nodejs" .tool-versions | awk '{print $2}')
REQUIRED_PNPM_VERSION=$(grep "pnpm" .tool-versions | awk '{print $2}')

# Get current versions
CURRENT_NODE_VERSION=$(node --version | sed 's/v//')
CURRENT_PNPM_VERSION=$(pnpm --version)

# Function to compare versions (returns 0 if current >= required, 1 otherwise)
version_ge() {
    printf '%s\n%s' "$2" "$1" | sort -V -C
}

# Verify Node.js version
if ! version_ge "$CURRENT_NODE_VERSION" "$REQUIRED_NODE_VERSION"; then
    echo -e "${RED}✗ Node.js version too old!${NC}"
    echo -e "  Required: ${YELLOW}>= $REQUIRED_NODE_VERSION${NC}"
    echo -e "  Current:  ${YELLOW}$CURRENT_NODE_VERSION${NC}"
    echo ""
    exit 1
fi

# Verify pnpm version
if ! version_ge "$CURRENT_PNPM_VERSION" "$REQUIRED_PNPM_VERSION"; then
    echo -e "${RED}✗ pnpm version too old!${NC}"
    echo -e "  Required: ${YELLOW}>= $REQUIRED_PNPM_VERSION${NC}"
    echo -e "  Current:  ${YELLOW}$CURRENT_PNPM_VERSION${NC}"
    echo ""
    exit 1
fi

echo -e "  ${GREEN}✓${NC} Node.js version: $CURRENT_NODE_VERSION"
echo -e "  ${GREEN}✓${NC} pnpm version: $CURRENT_PNPM_VERSION"
echo ""

# Configure Caddy
echo -e "${GREEN}[2/9]${NC} Configuring Caddy (first-time setup)..."

# Detect platform and set data directory
if [ "$IS_MACOS" = true ]; then
    CADDY_DATA_DIR="$HOME/Library/Application Support/Caddy"
elif [ "$IS_WINDOWS" = true ]; then
    CADDY_DATA_DIR="$HOME/AppData/Roaming/Caddy"
else
    CADDY_DATA_DIR="$HOME/.local/share/caddy"
fi

# Function to check if Caddy is running successfully
check_caddy_running() {
    # On Windows, pgrep might not be available, use alternative
    if [ "$IS_WINDOWS" = true ]; then
        if tasklist 2>/dev/null | grep -i "caddy.exe" >/dev/null 2>&1; then
            return 0
        fi
    else
        if pgrep -x caddy >/dev/null 2>&1; then
            return 0
        fi
    fi

    # Fallback: check if port 443 or 80 is open
    # Use netstat on Windows, lsof on Unix
    if [ "$IS_WINDOWS" = true ]; then
        if netstat -ano 2>/dev/null | grep ":443.*LISTENING" >/dev/null 2>&1 || \
           netstat -ano 2>/dev/null | grep ":80.*LISTENING" >/dev/null 2>&1; then
            return 0
        fi
    else
        if command -v lsof >/dev/null 2>&1; then
            if lsof -i :443 -sTCP:LISTEN >/dev/null 2>&1 || lsof -i :80 -sTCP:LISTEN >/dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    return 1
}

# Function to stop Caddy safely
stop_caddy() {
    if [ "$IS_WINDOWS" = true ]; then
        # On Windows, use taskkill
        taskkill //F //IM caddy.exe >/dev/null 2>&1 || true
        sleep 1
    else
        if pgrep -x caddy >/dev/null 2>&1; then
            killall caddy >/dev/null 2>&1 || pkill caddy >/dev/null 2>&1
            sleep 1
        fi
    fi
}

if [[ ! -d "$CADDY_DATA_DIR" ]] || [[ ! -d "$CADDY_DATA_DIR/certificates" ]]; then
    echo -e "  ${YELLOW}→${NC} Caddy needs to be configured for HTTPS development"
    echo -e "  ${YELLOW}→${NC} Starting Caddy to generate certificates..."
    echo ""
    
    # On Linux (not Windows or macOS), allow Caddy to bind to privileged ports
    if [ "$IS_LINUX" = true ] && [[ $(id -u) -ne 0 ]]; then
        echo -e "  ${YELLOW}→${NC} On Linux, giving Caddy permission to bind to port 443..."
        if ! sudo setcap 'cap_net_bind_service=+ep' "$(which caddy)" 2>/dev/null; then
            echo -e "  ${YELLOW}⚠${NC} Could not set capabilities. You may need to run Caddy with sudo."
        fi
    fi

    # Start Caddy in background
    (cd apps/reverse-proxy && caddy run > /dev/null 2>&1 &)
    CADDY_PID=$!

    echo -e "  ${YELLOW}→${NC} Waiting for Caddy to initialize..."

    CADDY_MAX_RETRIES=15

    for i in $(seq 1 $CADDY_MAX_RETRIES); do
        if check_caddy_running; then
            echo -e "  ${GREEN}✓${NC} Caddy is running (PID: $CADDY_PID)"
            break
        fi
        
        # Show progress
        if [ $((i % 5)) -eq 0 ]; then
            echo -e "    Still waiting... ($i/$CADDY_MAX_RETRIES seconds)"
        fi
        sleep 1
    done

    # Verify startup success
    if ! check_caddy_running; then
        echo -e "${RED}✗ Failed to start Caddy properly after $CADDY_MAX_RETRIES seconds${NC}"
        echo -e "  Please check your configuration or permissions."
        kill $CADDY_PID 2>/dev/null || true
        exit 1
    fi

    echo -e "  ${YELLOW}→${NC} Waiting for certificate generation..."
    sleep 3  # let it finish generating certs

    # Stop Caddy cleanly
    stop_caddy

    echo ""
    echo -e "  ${GREEN}✓${NC} Caddy configured successfully"
else
    echo -e "  ${GREEN}✓${NC} Caddy already configured (skipping)"
fi
echo ""

#  Install dependencies
echo -e "${GREEN}[3/9]${NC} Installing dependencies with pnpm..."
if ! pnpm install --prefer-offline > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

#  Build shared package
echo -e "${GREEN}[4/9]${NC} Building shared package..."
if ! pnpm --filter="@repo/shared" run build > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to build shared package${NC}"
    exit 1
fi

#  Set up environment files
echo -e "${GREEN}[5/9]${NC} Setting up environment files..."

# API .env

echo "  → Copying apps/api/.env.example to apps/api/.env"
cp apps/api/.env.example apps/api/.env
    
# Generate master key
echo "  → Generating master key..."
MASTER_KEY=$(openssl rand -base64 32)
if [ "$IS_MACOS" = true ]; then
    # macOS requires empty string after -i
    sed -i '' "s|MASTER_KEY=.*|MASTER_KEY=\"$MASTER_KEY\"|g" apps/api/.env
else
    # Linux and Windows (Git Bash/WSL)
    sed -i "s|MASTER_KEY=.*|MASTER_KEY=\"$MASTER_KEY\"|g" apps/api/.env
fi

# Web .env

echo "  → Copying apps/web/.env.example to apps/web/.env"
cp apps/web/.env.example apps/web/.env


#  Start Docker containers
echo -e "${GREEN}[6/9]${NC} Starting Docker containers..."

# Stop only this project's containers
echo "  → Stopping pre-existing project containers..."
docker compose down > /dev/null 2>&1 || true

echo "  → Starting containers using docker compose..."
if ! docker compose up -d > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to start Docker containers${NC}"
    exit 1
fi

# Wait for database to be ready with health check
echo "  → Waiting for database to be ready..."

MAX_RETRIES=30
RETRY_COUNT=0
DB_READY=false

while [ "$DB_READY" = false ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    DB_HEALTH=$(docker compose ps project-db --format json | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "starting")

    if [ "$DB_HEALTH" = "healthy" ]; then
        DB_READY=true
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "    Attempt $RETRY_COUNT/$MAX_RETRIES (status: $DB_HEALTH)..."
        sleep 1
    fi
done

if [ "$DB_READY" = false ]; then
    echo -e "${RED}✗ Database failed to start after $MAX_RETRIES attempts${NC}"
    exit 1
fi

#  Run database migrations
echo -e "${GREEN}[7/9]${NC} Running database migrations..."
if ! pnpm db:migrate > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to run database migrations${NC}"
    exit 1
fi

#  Seed the database
echo -e "${GREEN}[8/9]${NC} Seeding the database..."
if ! pnpm --filter=api run db:seed-prod > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to seed database${NC}"
    exit 1
fi

#  Verify setup
echo -e "${GREEN}[9/9]${NC} Verifying setup..."

# Check if critical services are running
CRITICAL_SERVICES=("project-db" "redis" "minio")
ALL_RUNNING=true

for service in "${CRITICAL_SERVICES[@]}"; do
    if docker compose ps "$service" --format json | grep -q '"State":"running"'; then
        echo -e "  ${GREEN}✓${NC} $service is running"
    else
        echo -e "  ${RED}✗${NC} $service is not running"
        ALL_RUNNING=false
    fi
done

if [ "$ALL_RUNNING" = false ]; then
    echo -e "${RED}✗ Some critical services are not running${NC}"
    exit 1
fi

# Remove error trap since we succeeded
trap - ERR

# Display success message with credentials
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Setup completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Created user accounts:${NC}"
echo ""
echo -e "  ${BLUE}Admin User:${NC}"
echo -e "    Email:    ${GREEN}admin@example.com${NC}"
echo -e "    Password: ${GREEN}password${NC}"
echo ""
echo -e "  ${BLUE}Student User:${NC}"
echo -e "    Email:    ${GREEN}user@example.com${NC}"
echo -e "    Password: ${GREEN}password${NC}"
echo ""
echo -e "  ${BLUE}Content Creator:${NC}"
echo -e "    Email:    ${GREEN}contentcreator@example.com${NC}"
echo -e "    Password: ${GREEN}password${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Run ${GREEN}pnpm dev${NC} to start the development servers"
echo -e "  2. Open ${GREEN}https://app.lms.localhost${NC} in your browser"
echo -e "  3. Log in with one of the accounts above"
echo ""
