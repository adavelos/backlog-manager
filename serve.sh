#!/bin/bash
# Builds the frontend and serves it from the FastAPI backend as a single
# process on one port — the "same server" production mode. For active
# development with hot reload, use ./start.sh instead.
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PORT="${PORT:-3000}"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "frontend/node_modules not found. Running npm install..."
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "Building frontend..."
(cd "$FRONTEND_DIR" && npm run build)

LOG_FILE=/tmp/backlog-manager.log
PID_FILE=/tmp/backlog-manager.pid

echo "Starting Backlog Manager on port $PORT..."
(cd "$BACKEND_DIR" && BACKLOG_STATIC_DIR="$FRONTEND_DIR/dist" \
  nohup uv run uvicorn app.main:app --port "$PORT" > "$LOG_FILE" 2>&1 &
 echo $! > "$PID_FILE")

echo "Backlog Manager started in background (PID: $(cat "$PID_FILE"))"
echo "Logs: $LOG_FILE"
echo "Open: http://localhost:$PORT/"
echo "Stop with: ./stop.sh"
