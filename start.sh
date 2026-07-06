#!/bin/bash
# Starts the backend (FastAPI/uvicorn) and frontend (Vite dev server) in the
# background for local development. For a single-process "prod-like" run
# (one port, no separate dev server), use ./serve.sh instead.
set -e

SCRIPT_DIR="$(dirname "$0")"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Load port configuration from .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

BACKEND_PORT="${BACKLOG_BACKEND_PORT:-8001}"
FRONTEND_PORT="${BACKLOG_FRONTEND_PORT:-5173}"

BACKEND_LOG=/tmp/backlog-manager-backend.log
FRONTEND_LOG=/tmp/backlog-manager-frontend.log
BACKEND_PID_FILE=/tmp/backlog-manager-backend.pid
FRONTEND_PID_FILE=/tmp/backlog-manager-frontend.pid

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

echo "Starting backend (FastAPI) on port $BACKEND_PORT..."
(cd "$BACKEND_DIR" && BACKLOG_BACKEND_PORT="$BACKEND_PORT" nohup uv run uvicorn app.main:app --port "$BACKEND_PORT" > "$BACKEND_LOG" 2>&1 &
 echo $! > "$BACKEND_PID_FILE")

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "frontend/node_modules not found. Running npm install..."
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "Starting frontend (Vite) on port $FRONTEND_PORT..."
(cd "$FRONTEND_DIR" && export BACKLOG_BACKEND_PORT="$BACKEND_PORT" && \
  nohup npm run dev -- --port "$FRONTEND_PORT" > "$FRONTEND_LOG" 2>&1 &
 echo $! > "$FRONTEND_PID_FILE")

echo ""
echo "Backlog Manager (dev mode) started."
echo "  Frontend: http://localhost:$FRONTEND_PORT  (backend PID: $(cat "$BACKEND_PID_FILE"), frontend PID: $(cat "$FRONTEND_PID_FILE"))"
echo "  Logs: $BACKEND_LOG , $FRONTEND_LOG"
echo "  Stop with: ./stop.sh"
