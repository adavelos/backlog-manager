# Data Recovery Guide

This file explains how to recover your backlog data if something goes wrong.

The backend (FastAPI + SQLAlchemy) stores everything in a single SQLite
database at `~/.backlog/data/backlog.sqlite3` (override with
`BACKLOG_DATA_DIR`), with WAL mode enabled for crash safety. There is no
JSON backup file in this architecture — recovery relies on SQLite's own
crash safety plus the timestamped backups from `backup.sh`.

---

## Recovery Methods

### 1. Restore from a Timestamped Backup

`backup.sh` creates copies under `~/.backlog/backups/`, keeping the last 7:

```bash
# List available backups
ls -lh ~/.backlog/backups/

# Stop the app
./stop.sh

# Restore a specific backup (pick the timestamp you want)
cp ~/.backlog/backups/backlog_2026-07-01_14-30-45.sqlite3 ~/.backlog/data/backlog.sqlite3
rm -f ~/.backlog/data/backlog.sqlite3-wal ~/.backlog/data/backlog.sqlite3-shm

# Restart
./start.sh   # or ./serve.sh for single-process mode
```

Run `./backup.sh` periodically (or before risky operations like a schema
migration) to create a fresh restore point.

### 2. Manual SQLite Recovery

```bash
# Stop the app first
./stop.sh

# Check database integrity
sqlite3 ~/.backlog/data/backlog.sqlite3 "PRAGMA integrity_check;"

# Inspect data directly
sqlite3 ~/.backlog/data/backlog.sqlite3 "SELECT COUNT(*) FROM items;"
```

### 3. WAL File Grew Too Large / Won't Start

```bash
./stop.sh
rm ~/.backlog/data/backlog.sqlite3-wal ~/.backlog/data/backlog.sqlite3-shm
./start.sh
```

SQLite recreates the WAL/SHM files on next write; this does not touch the
main `backlog.sqlite3` file itself.

---

## Diagnosing Issues

### Server won't start

```bash
# Dev mode logs
cat /tmp/backlog-manager-backend.log
cat /tmp/backlog-manager-frontend.log

# Single-process (serve.sh) log
cat /tmp/backlog-manager.log
```

Common issues:
- Port already in use: change it via `BACKLOG_BACKEND_PORT` / `BACKLOG_FRONTEND_PORT` (dev) or `PORT` (serve.sh)
- Missing Python deps: `cd backend && uv sync` (or `pip install -r requirements.txt`)
- Missing frontend deps: `cd frontend && npm install`

### Data is there but not showing in the UI

1. Verify the API directly:
   ```bash
   curl http://localhost:8000/api/backlog | python3 -m json.tool | head -30
   ```
2. If the API returns data but the UI doesn't show it, check the browser console for errors and confirm you're on the right Work/Argonath toggle and project filter.

### Migration errors on startup

Migrations live in `backend/alembic/versions/`. If a migration fails on
startup, the log will show the Alembic error. Do **not** hand-edit rows to
work around it — fix or roll back the migration script and restart. See
"Database Schema Changes" in `CLAUDE.md` for the review process agents
must follow when adding new migrations.

---

## Worst Case: Database Is Corrupted and No Backup Exists

Since data in this app was established to be low-stakes/reproducible
(no external system of record), if there's truly no usable backup and the
database won't open, the pragmatic option is to move the corrupt file
aside and let the app create a fresh one:

```bash
./stop.sh
mv ~/.backlog/data/backlog.sqlite3 ~/.backlog/data/backlog.sqlite3.corrupt
rm -f ~/.backlog/data/backlog.sqlite3-wal ~/.backlog/data/backlog.sqlite3-shm
./start.sh   # runs Alembic migrations, creates a fresh empty schema
```

This is destructive to any data in the corrupt file — keep the
`.corrupt` copy until you're sure you don't need to hand-recover
anything from it with the `sqlite3` CLI.
