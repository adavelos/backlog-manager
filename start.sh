#!/bin/bash

# Export env var so Node/Express can read it
export BACKLOG_DATA_DIR=/home/adavelos/.backlog/data \

echo "Starting Backlog Manager..."
echo "  DATA_DIR = $BACKLOG_DATA_DIR"
echo "  using server.js via npm"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "node_modules not found. Running npm install..."
  npm install
fi

# Start the server
npm start