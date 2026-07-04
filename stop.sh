#!/bin/bash
# Stops processes started by start.sh (dev mode) and/or serve.sh (prod mode).

stop_by_pidfile() {
  local pid_file="$1"
  local label="$2"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    rm -f "$pid_file"
    if kill "$pid" 2>/dev/null; then
      echo "Stopped $label (PID: $pid)."
      return 0
    fi
    echo "$label PID file was stale (process $pid not running)."
  fi
  return 1
}

if ! stop_by_pidfile /tmp/backlog-manager-backend.pid "backend (dev)"; then
  pkill -f "uvicorn app.main:app" 2>/dev/null && echo "Stopped backend via pkill." || echo "No dev backend found."
fi

if ! stop_by_pidfile /tmp/backlog-manager-frontend.pid "frontend (dev)"; then
  pkill -f "vite --port" 2>/dev/null && echo "Stopped frontend via pkill." || echo "No dev frontend found."
fi

stop_by_pidfile /tmp/backlog-manager.pid "backend (prod)" || true

echo "Done."
