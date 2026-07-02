#!/bin/bash

# BACKLOG_DATA_DIR is optional now — server.js defaults to ~/.backlog/data
# on its own. Only set this if you want to point at a different location.

echo "Starting Backlog Manager..."
echo "  using server.js via npm"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "node_modules not found. Running npm install..."
  npm install
fi

LOG_FILE="/tmp/backlog-manager.log"

# Start the server in the background, detached from the terminal
nohup npm start > "$LOG_FILE" 2>&1 &

# Save the PID so it can be stopped later
PID=$!
echo $PID > /tmp/backlog-manager.pid
echo "Backlog Manager started in background (PID: $PID)"
echo "Logs: $LOG_FILE"
echo "Check status: curl -s http://localhost:3000/api/config | head -c 200"