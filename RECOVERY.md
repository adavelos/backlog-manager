# Data Recovery Guide

This file explains how to restore your backlog data if something goes wrong.

## Quick Start

If your database is corrupted or you want to revert to a known-good state:

```bash
# Restore from JSON backup (most recent backup)
node restore-from-json.js

# Restart the server
npm start
```

This will replace the SQLite database with data from `~/.backlog/data/backlog.json.bak`.

---

## Recovery Methods

### 1. Restore from JSON Backup (Recommended)

**When to use:**
- Database is corrupted or won't load
- Data mysteriously disappeared
- Server crashed and won't start
- You need to roll back to the last known-good state

**Steps:**

```bash
# 1. Stop the server
./stop.sh
# (or kill the process if using npm start)

# 2. Restore from JSON backup
node restore-from-json.js

# 3. Restart the server
npm start

# 4. Open http://localhost:3000 and verify data is restored
```

**What it does:**
- Reads `~/.backlog/data/backlog.json.bak` (the most recent JSON snapshot)
- Clears all tables in `backlog.db`
- Re-inserts all projects, releases, items, and notes
- Preserves original timestamps and IDs

### 2. Manual SQLite Recovery

If you prefer to use SQLite directly:

```bash
# 1. Stop the server
./stop.sh

# 2. Install sqlite3 CLI (if not already installed)
# On macOS: brew install sqlite3
# On Ubuntu/Debian: sudo apt-get install sqlite3

# 3. Check database integrity
sqlite3 ~/.backlog/data/backlog.db "PRAGMA integrity_check;"

# 4. If corrupted, restore from backup
sqlite3 ~/.backlog/data/backlog.db < backup.sql

# 5. Restart the server
npm start
```

### 3. Restore from Timestamped Backups

The `backup.sh` script creates timestamped backups:

```bash
# List all backups
ls -lh ~/.backlog/data/backlog.*.sql

# Find the backup you want (they're named by timestamp)
# Example: backlog.2026-07-01_14-30-45.sql

# Restore from a specific backup
sqlite3 ~/.backlog/data/backlog.db < ~/.backlog/data/backlog.2026-07-01_14-30-45.sql

# Restart the server
npm start
```

---

## Backup Strategy

### Automatic Backups

**JSON Backup** (`~/.backlog/data/backlog.json.bak`):
- Updated every time the server writes data
- Kept in sync with the current state
- Used by `restore-from-json.js` as the recovery source

**SQLite WAL Files** (`~/.backlog/data/backlog.db-wal`):
- Write-ahead log for crash safety
- Automatically managed by SQLite
- Cleaned up periodically by checkpoints

### Manual Backups

Create a timestamped backup before major operations:

```bash
# Create a backup with timestamp
./backup.sh

# This creates: ~/.backlog/data/backlog.YYYY-MM-DD_HH-MM-SS.sql
# Keeps last 7 backups automatically
```

---

## Diagnosing Issues

### Database won't open

```bash
# Check file permissions
ls -l ~/.backlog/data/backlog.db

# Check disk space
df -h ~/.backlog/data

# Try to open it directly
sqlite3 ~/.backlog/data/backlog.db "SELECT COUNT(*) FROM items;"
```

### Data is there but not showing in UI

1. Check server logs:
   ```bash
   # If running with npm start, look at console output
   # If running with ./start.sh, check logs:
   cat /tmp/backlog-manager.log | tail -50
   ```

2. Verify API is working:
   ```bash
   curl http://localhost:3000/api/backlog | jq '.' | head -20
   ```

3. If empty, restore from JSON:
   ```bash
   node restore-from-json.js
   npm start
   ```

### Server won't start

```bash
# Check logs
cat /tmp/backlog-manager.log | tail -100

# Common issues:
# - Port 3000 already in use: killall node
# - Database locked: rm ~/.backlog/data/backlog.db-wal ~/.backlog/data/backlog.db-shm
# - Missing dependencies: npm install
```

### WAL file is too large (>100MB)

```bash
# Stop the server
./stop.sh

# Remove WAL files (they'll be recreated)
rm ~/.backlog/data/backlog.db-wal
rm ~/.backlog/data/backlog.db-shm

# Restart
npm start
```

---

## Before Restoring

1. **Backup your backup:**
   ```bash
   cp ~/.backlog/data/backlog.json.bak ~/.backlog/data/backlog.json.bak.pre-restore
   cp ~/.backlog/data/backlog.db ~/.backlog/data/backlog.db.pre-restore
   ```

2. **Check what you're restoring:**
   ```bash
   # If using restore-from-json.js:
   head -100 ~/.backlog/data/backlog.json.bak | jq '.projects[0]'
   ```

3. **Know when the backup was made:**
   ```bash
   ls -lh ~/.backlog/data/backlog.json.bak
   # Shows the modification time
   ```

---

## Worst Case: Database is Completely Corrupted

If the SQLite database is unrecoverable:

```bash
# 1. Stop the server
./stop.sh

# 2. Delete the corrupted database
rm ~/.backlog/data/backlog.db
rm ~/.backlog/data/backlog.db-wal
rm ~/.backlog/data/backlog.db-shm

# 3. Restore from JSON (creates a new database)
node restore-from-json.js

# 4. Restart the server
npm start

# 5. Verify
open http://localhost:3000
```

---

## Data Loss Scenarios

### Scenario 1: "I made changes but they're gone after restart"
- The changes weren't saved to the database
- Check if auto-save was working (look for logs)
- If possible, restore from backup and re-do your work
- Make sure the server finished saving before restarting

### Scenario 2: "Items are missing but the database is fine"
- Check if they're archived (DONE items > 7 days old)
- Look in the Archive panel on the Boards page
- If still missing, check the database directly:
  ```bash
  sqlite3 ~/.backlog/data/backlog.db "SELECT COUNT(*) FROM items;"
  ```

### Scenario 3: "Database says 1000 items but UI shows 50"
- Filtering might be active
- Clear all filters: click "ALL" projects and set view to "State Board"
- If still missing, reload the page (Ctrl+R)
- If still broken, restore from JSON

---

## Testing Your Recovery

After restoring, always verify:

```bash
# 1. Check server starts
npm start &

# 2. Wait 2 seconds
sleep 2

# 3. Check API responds
curl http://localhost:3000/api/backlog | jq '.projects | length'

# 4. Open in browser and spot-check data
open http://localhost:3000

# 5. Kill server
./stop.sh
```

---

## Questions?

- Check `/tmp/backlog-manager.log` for detailed error messages
- Verify backups exist: `ls -lh ~/.backlog/data/`
- Ensure Node.js is installed: `node --version`
- Make sure npm dependencies are installed: `npm install`
