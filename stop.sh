#!/bin/bash

PID_FILE=/tmp/backlog-manager.pid

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  rm -f "$PID_FILE"
  if kill "$PID" 2>/dev/null; then
    echo "Stopped Backlog Manager (PID: $PID)."
    exit 0
  fi
  echo "PID file was stale (process $PID not running). Trying pkill..."
fi

pkill -f "node server.js" && echo "Stopped." || echo "No running Backlog Manager found."
