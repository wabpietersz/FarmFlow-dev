#!/bin/bash
# Switch the local app between the test data and the clean (development) database.
#   ./scripts/env.sh test          stop whatever is running, start backend on farmflow_uat + frontend
#   ./scripts/env.sh test --fresh  same, but rebuild the test data first (wipes anything entered)
#   ./scripts/env.sh clean         stop whatever is running, start backend on the database in .env + frontend
#   ./scripts/env.sh stop          just stop the backend and frontend
set -e
cd "$(dirname "$0")/.."

TEST_DB_URL="${TESTDATA_DATABASE_URL:-postgresql://farmflow:farmflow_dev@localhost:5432/farmflow_uat}"

stop_all() {
  # Watchers first, or they respawn the servers they watch
  pkill -f "tsx.*watch src/server.ts" 2>/dev/null || true
  for port in 3001 5173; do
    pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pids" ] && kill $pids 2>/dev/null || true
  done
  sleep 1
  for port in 3001 5173; do
    pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  done
}

start_all() {
  docker ps --format '{{.Names}}' | grep -q farmflow-db || docker compose up -d postgres
  trap 'kill 0; exit 0' SIGINT SIGTERM
  npm run dev -w packages/backend &
  npm run dev -w packages/frontend -- --port 5173 --strictPort &
  wait
}

case "$1" in
  stop)
    stop_all; echo "Stopped." ;;
  test)
    stop_all
    [ "$2" = "--fresh" ] && npm run db:testdata
    echo "Starting on the TEST data (farmflow_uat). Clear the browser's site data if the screen still shows the other database."
    export DATABASE_URL="$TEST_DB_URL"
    start_all ;;
  clean)
    stop_all
    echo "Starting on the CLEAN database (the one in packages/backend/.env). Clear the browser's site data if the screen still shows the other database."
    unset DATABASE_URL
    start_all ;;
  *)
    echo "Usage: $0 test [--fresh] | clean | stop"; exit 1 ;;
esac
