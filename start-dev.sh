#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  FarmFlow Development Environment${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. Start PostgreSQL via Docker Compose
echo -e "\n${YELLOW}[1/5] Starting PostgreSQL...${NC}"
if docker ps --format '{{.Names}}' | grep -q farmflow-db; then
  echo -e "${GREEN}  ✓ PostgreSQL already running${NC}"
else
  docker compose up -d postgres
  echo -e "  Waiting for PostgreSQL to be healthy..."
  until docker exec farmflow-db pg_isready -U farmflow -d farmflow_dev > /dev/null 2>&1; do
    sleep 1
  done
  echo -e "${GREEN}  ✓ PostgreSQL started${NC}"
fi

# 2. Install dependencies
echo -e "\n${YELLOW}[2/5] Installing dependencies...${NC}"
npm install --silent 2>/dev/null
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# 3. Build shared package
echo -e "\n${YELLOW}[3/5] Building shared package...${NC}"
npm run build:shared 2>/dev/null
echo -e "${GREEN}  ✓ Shared package built${NC}"

# 4. Run migrations & seed
echo -e "\n${YELLOW}[4/5] Running database migrations...${NC}"
npm run db:migrate 2>/dev/null || echo -e "${YELLOW}  ⚠ Migrations may already be applied${NC}"
echo -e "${GREEN}  ✓ Database ready${NC}"

# 5. Start backend and frontend
echo -e "\n${YELLOW}[5/5] Starting applications...${NC}"
echo -e "${GREEN}  Backend:  ${NC}http://localhost:3001/api/health"
echo -e "${GREEN}  Frontend: ${NC}http://localhost:5173"
echo -e "${GREEN}  PgAdmin:  ${NC}http://localhost:5050"
echo -e ""
echo -e "${BLUE}Starting backend and frontend in parallel...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Run backend and frontend concurrently
# Trap SIGINT to kill both processes
trap 'kill 0; exit 0' SIGINT SIGTERM

npm run dev:backend &
BACKEND_PID=$!

npm run dev:frontend &
FRONTEND_PID=$!

wait
