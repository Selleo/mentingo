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

# Prerequisites check
echo -e "${GREEN}[0/8]${NC} Checking prerequisites..."

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
for cmd in node pnpm docker openssl; do
    if ! command -v $cmd > /dev/null 2>&1; then
        echo -e "${RED}✗ $cmd is not installed!${NC}"
        exit 1
    fi
done

echo -e "  ${GREEN}✓${NC} All required tools are available"
echo ""

# Version verification
echo -e "${GREEN}[1/8]${NC} Verifying tool versions..."

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

# Step 2: Install dependencies
echo -e "${GREEN}[2/8]${NC} Installing dependencies with pnpm..."
if ! pnpm install --prefer-offline > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# Step 3: Build shared package
echo -e "${GREEN}[3/8]${NC} Building shared package..."
if ! pnpm --filter="@repo/shared" run build > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to build shared package${NC}"
    exit 1
fi

# Step 4: Set up environment files
echo -e "${GREEN}[4/8]${NC} Setting up environment files..."

# API .env
if [[ -f "apps/api/.env" ]]; then
    echo -e "  ${YELLOW}⚠${NC}  apps/api/.env already exists, skipping..."
else
    echo "  → Copying apps/api/.env.example to apps/api/.env"
    cp apps/api/.env.example apps/api/.env
    
    # Generate master key
    echo "  → Generating master key..."
    MASTER_KEY=$(openssl rand -base64 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|MASTER_KEY=.*|MASTER_KEY=\"$MASTER_KEY\"|g" apps/api/.env
    else
        # Linux and Windows (Git Bash/WSL)
        sed -i "s|MASTER_KEY=.*|MASTER_KEY=\"$MASTER_KEY\"|g" apps/api/.env
    fi
fi

# Web .env
if [[ -f "apps/web/.env" ]]; then
    echo -e "  ${YELLOW}⚠${NC}  apps/web/.env already exists, skipping..."
else
    echo "  → Copying apps/web/.env.example to apps/web/.env"
    cp apps/web/.env.example apps/web/.env
fi


# Step 5: Start Docker containers
echo -e "${GREEN}[5/8]${NC} Starting Docker containers..."

# Stop only this project's containers
echo "  → Stopping pre-existing project containers..."
docker compose down > /dev/null 2>&1 || true

echo "  → Starting containers using docker compose..."
if ! docker compose up -d; then
    echo -e "${RED}✗ Failed to start Docker containers${NC}"
    exit 1
fi

# Wait for database to be ready with health check
echo "  → Waiting for database to be ready..."
MAX_RETRIES=15
RETRY_COUNT=0
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "    Attempt $RETRY_COUNT/$MAX_RETRIES..."
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Database failed to start${NC}"
    exit 1
fi

# Step 6: Run database migrations
echo -e "${GREEN}[6/8]${NC} Running database migrations..."
if ! pnpm db:migrate > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to run database migrations${NC}"
    exit 1
fi

# Step 7: Seed the database
echo -e "${GREEN}[7/8]${NC} Seeding the database..."
if ! (cd apps/api && ts-node -r tsconfig-paths/register ./src/seed/seed-prod.ts > /dev/null 2>&1); then
    echo -e "${RED}✗ Failed to seed database${NC}"
    exit 1
fi

# Step 8: Verify setup
echo -e "${GREEN}[8/8]${NC} Verifying setup..."
if docker compose ps | grep -q "Up"; then
    echo -e "  ${GREEN}✓${NC} Docker containers are running"
else
    echo -e "${RED}✗ Some Docker containers are not running${NC}"
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
