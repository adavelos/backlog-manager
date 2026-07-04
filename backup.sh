#!/bin/bash
# ============================================
# Backlog Manager — Database Backup Script
# ============================================
# Creates timestamped backup of SQLite database
# Automatically rotates old backups (keeps last 7)

set -e

BACKUP_DIR="$HOME/.backlog/backups"
DB_PATH="$HOME/.backlog/data/backlog.sqlite3"
KEEP_COUNT=7

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Verify DB exists
if [ ! -f "$DB_PATH" ]; then
  echo "❌ Error: Database not found at $DB_PATH"
  exit 1
fi

# Create timestamped backup
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/backlog_$TIMESTAMP.sqlite3"

cp "$DB_PATH" "$BACKUP_FILE"
chmod 644 "$BACKUP_FILE"

echo "✓ Backup created: $BACKUP_FILE"

# Rotate old backups (keep only last N)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backlog_*.sqlite3 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$KEEP_COUNT" ]; then
  EXCESS=$((BACKUP_COUNT - KEEP_COUNT))
  ls -t "$BACKUP_DIR"/backlog_*.sqlite3 | tail -n "$EXCESS" | xargs rm -f
  echo "✓ Cleaned up $EXCESS old backup(s) (keeping last $KEEP_COUNT)"
fi

# Show backup summary
echo ""
echo "📦 Backup directory: $BACKUP_DIR"
echo "📊 Total backups: $(ls -1 "$BACKUP_DIR"/backlog_*.sqlite3 2>/dev/null | wc -l)"
echo "💾 Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
