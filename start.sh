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

# Start the server in the background
npm start &

# Save the PID so it can be stopped later
echo $! > /tmp/backlog-manager.pid
echo "Backlog Manager started in background (PID: $(cat /tmp/backlog-manager.pid))"
echo "Logs: /tmp/backlog-manager.log"