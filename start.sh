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

cleanup() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
  fi
}

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

echo "Starting backend (FastAPI) on port $BACKEND_PORT..."
(cd "$BACKEND_DIR" && BACKLOG_BACKEND_PORT="$BACKEND_PORT" nohup uv run uvicorn app.main:app --port "$BACKEND_PORT" > "$BACKEND_LOG" 2>&1 &
 echo $! > "$BACKEND_PID_FILE")

sleep 2
if ! kill -0 "$(cat "$BACKEND_PID_FILE" 2>/dev/null)" 2>/dev/null; then
  echo "ERROR: Backend failed to start on port $BACKEND_PORT (port may be in use)."
  echo "Last log lines:"
  tail -5 "$BACKEND_LOG" 2>/dev/null || true
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "frontend/node_modules not found. Running npm install..."
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "Starting frontend (Vite) on port $FRONTEND_PORT..."
(cd "$FRONTEND_DIR" && export BACKLOG_BACKEND_PORT="$BACKEND_PORT" && \
  nohup npm run dev -- --port "$FRONTEND_PORT" --strictPort > "$FRONTEND_LOG" 2>&1 &
 echo $! > "$FRONTEND_PID_FILE")

sleep 3
if ! kill -0 "$(cat "$FRONTEND_PID_FILE" 2>/dev/null)" 2>/dev/null; then
  echo "ERROR: Frontend failed to start on port $FRONTEND_PORT (port may be in use)."
  echo "Last log lines:"
  tail -5 "$FRONTEND_LOG" 2>/dev/null || true
  cleanup "$BACKEND_PID_FILE"
  exit 1
fi

echo ""
echo "Backlog Manager (dev mode) started."
echo "  Frontend: http://localhost:$FRONTEND_PORT  (backend PID: $(cat "$BACKEND_PID_FILE"), frontend PID: $(cat "$FRONTEND_PID_FILE"))"
echo "  Logs: $BACKEND_LOG , $FRONTEND_LOG"
echo "  Stop with: ./stop.sh"
