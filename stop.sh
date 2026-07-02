#!/bin/bash

PID_FILE=/tmp/backlog-manager.pid

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  echo "Stopping Backlog Manager (PID: $PID)..."
  kill "$PID" 2>/dev/null && echo "Stopped." || echo "Process not running."
  rm -f "$PID_FILE"
else
  echo "No PID file found. Trying pkill..."
  pkill -f "node server.js" && echo "Stopped." || echo "No running Backlog Manager found."
fi
