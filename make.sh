#!/usr/bin/env bash
# Backlog Manager: one command per action. Run ./make.sh help for the list.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

RUN_DIR="$ROOT/.run"   # pid files and logs of what dev/serve started (git-ignored)
DATA_DIR="${BACKLOG_DATA_DIR:-$HOME/.backlog/data}"
BACKUP_DIR="${BACKLOG_BACKUP_DIR:-$HOME/.backlog/backups}"

load_env() {
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env.dev"
  set +a
  BACKEND_PORT="${BACKLOG_BACKEND_PORT:-8001}"
  FRONTEND_PORT="${BACKLOG_FRONTEND_PORT:-5173}"
}

need_uv() { command -v uv >/dev/null 2>&1 || { echo "uv not found. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }; }
ui_deps() { [ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm ci --no-audit --no-fund); }

# start_bg NAME DIR CMD...: run CMD in DIR in the background, record pid and log under .run/
start_bg() {
  local name=$1 dir=$2; shift 2
  mkdir -p "$RUN_DIR"
  (cd "$dir" && nohup "$@" > "$RUN_DIR/$name.log" 2>&1 & echo $! > "$RUN_DIR/$name.pid")
  sleep 2
  if ! kill -0 "$(cat "$RUN_DIR/$name.pid")" 2>/dev/null; then
    echo "ERROR: $name failed to start (port in use?). Last log lines:"; tail -5 "$RUN_DIR/$name.log" || true
    rm -f "$RUN_DIR/$name.pid"; return 1
  fi
}

usage() {
  cat <<'EOF2'
Usage: ./make.sh <command>

  dev                 API with auto-reload (BACKLOG_BACKEND_PORT) and Vite UI (BACKLOG_FRONTEND_PORT), in the background
  serve               build the UI, then serve API, MCP and UI on BACKLOG_BACKEND_PORT, in the background
  stop                stop what dev, serve or up started locally
  build               build the UI into frontend/dist
  test                backend tests, then a UI build
  backup              copy the local database to ~/.backlog/backups/ (SQLite backup API, integrity check, newest 14 kept)
  token NAME          print a new MCP token line for client NAME, for a *.secrets file
  up | down | logs    the container (compose.yml); data in ./data
  deploy ACTION       the server, through foundation/ops/app-deploy.sh (ACTION: all, sync, status, install-backup,
                      backup, fetch-backup, ...; add --dry-run first to print the commands)
EOF2
}

cmd="${1:-help}"
shift || true
case "$cmd" in
  dev)
    load_env; need_uv; ui_deps
    start_bg backend "$ROOT/backend" env BACKLOG_BACKEND_PORT="$BACKEND_PORT" uv run uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload
    start_bg frontend "$ROOT/frontend" env BACKLOG_BACKEND_PORT="$BACKEND_PORT" npm run dev -- --port "$FRONTEND_PORT" --strictPort || { ./make.sh stop; exit 1; }
    echo "Dev mode: http://localhost:$FRONTEND_PORT (API on $BACKEND_PORT). Logs in .run/. Stop with ./make.sh stop"
    ;;
  serve)
    load_env; need_uv; ui_deps
    (cd frontend && npm run build)
    start_bg serve "$ROOT/backend" env BACKLOG_STATIC_DIR="$ROOT/frontend/dist" uv run uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
    echo "Serving on http://localhost:$BACKEND_PORT/. Log in .run/serve.log. Stop with ./make.sh stop"
    ;;
  stop)
    for f in "$RUN_DIR"/*.pid; do
      [ -e "$f" ] || continue
      pid=$(cat "$f"); n=$(basename "$f" .pid)
      # kill the process group children too (uv/npm spawn the real server)
      pkill -P "$pid" 2>/dev/null || true
      if kill "$pid" 2>/dev/null; then echo "Stopped $n (PID $pid)."; else echo "$n was not running."; fi
      rm -f "$f"
    done
    if command -v docker >/dev/null 2>&1 && docker ps -q --filter name='^backlog$' 2>/dev/null | grep -q .; then
      docker compose stop && echo "Stopped the container."
    fi
    ;;
  build)
    ui_deps; cd frontend && npm run build
    ;;
  test)
    need_uv
    (cd backend && uv run pytest -q)
    ui_deps; (cd frontend && npm run build)
    ;;
  backup)
    need_uv
    db="$DATA_DIR/backlog.sqlite3"
    [ -f "$db" ] || { echo "Database not found: $db"; exit 1; }
    mkdir -p "$BACKUP_DIR"
    out="$BACKUP_DIR/backlog-$(date +%Y%m%d-%H%M%S).sqlite3"
    (cd backend && uv run python -c "
import sqlite3, sys
s = sqlite3.connect(sys.argv[1]); d = sqlite3.connect(sys.argv[2]); s.backup(d); s.close()
r = d.execute('PRAGMA integrity_check').fetchone()[0]; d.close()
sys.exit(0 if r == 'ok' else 'integrity check failed: ' + r)" "$db" "$out") || { rm -f "$out"; exit 1; }
    ls -1t "$BACKUP_DIR"/backlog-*.sqlite3 | tail -n +15 | xargs -r rm --
    echo "Backup: $out"
    ;;
  token)
    [ $# -eq 1 ] || { echo "Usage: ./make.sh token CLIENT_NAME"; exit 2; }
    echo "$1:$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
    echo "Add it to BACKLOG_MCP_TOKENS in .env.prod.secrets (comma separated), then restart." >&2
    ;;
  up)
    mkdir -p "$ROOT/data"
    docker network inspect pa-edge >/dev/null 2>&1 || docker network create pa-edge >/dev/null
    docker compose up -d --build
    ;;
  down) docker compose down ;;
  logs) docker compose logs -f backlog ;;
  deploy)
    opts=()
    if [ "${1:-}" = --dry-run ]; then opts=(--dry-run); shift; fi
    # The service and container are named backlog, not the folder name; REMOTE_DIR keeps the default /opt/pa/backlog-manager.
    APP_SERVICE=backlog REMOTE_DIR=/opt/pa/backlog-manager exec "$ROOT/../foundation/ops/app-deploy.sh" "${opts[@]}" "$ROOT" "$@"
    ;;
  help|-h|--help) usage ;;
  *) usage; exit 2 ;;
esac
