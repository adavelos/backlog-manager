# Backlog Manager

Backlog Manager is the owner's backlog of projects, releases and items. It shows them as kanban boards (by state or by release), offers a quick-edit table for titles, and keeps Markdown notes and a scratchpad per project type (`work` and `argonath`). Claude reaches it through an MCP server (Model Context Protocol, the interface AI tools use to call an application). It is owner-only.

The shared rules it follows are in the foundation: [STACK.md](../foundation/standards/STACK.md) and [PRINCIPLES.md](../foundation/PRINCIPLES.md). How the code is organised: [docs/architecture.md](docs/architecture.md). Data model: [docs/model.md](docs/model.md). REST API: [API_SPEC.md](API_SPEC.md).

## Status labels

- `Implemented`: built and tested in this repository.
- `Deployed`: running on the server.
- `Not verified`: not checked from this repository.

## What is implemented

- `Implemented`: Vue 3 + Vite single-page app (Boards, Projects, Notes), FastAPI REST API under `/api`, SQLite database with plain SQL migrations (`backend/app/migrations.py`; there is no Alembic).
- `Implemented`: MCP server at `/mcp`, inside the web application, with read tools `list_projects`, `list_items`, `get_candidate_items`, `get_item` and write tools `create_project`, `create_item`, `update_item`. There is no delete tool.
- `Implemented`: container image and `compose.yml`; `./make.sh` for every action.
- `Deployed`: the application runs on the server as service and container `backlog` (healthy at the status check of 2026-10-27), and the claude.ai connector works through OAuth with Authelia. The deployed commit is `Not verified`.
- `Verified` 2026-10-27: the nightly backup (03:30, `app-backup.sh backlog`) is in root's crontab, and the newest backup (`backlog_2026-10-27_12-57-36.sqlite3`) was downloaded and passed `ops/sqlite-restore-check.py`. See [Backup and restore](#backup-and-restore).

## Quick start

Prerequisites: `uv`, Node.js 22 or later, and Docker for the container commands.

```bash
./make.sh serve      # build the UI, serve everything on http://localhost:8001/
./make.sh stop       # stop it
```

For development with hot reload, `./make.sh dev` serves the API on port 8001 and the Vite UI on port 5173 (open `http://localhost:5173`). Ports come from [.env.dev](.env.dev).

## Commands

| Command | What it does |
|---------|--------------|
| `./make.sh dev` | API with auto-reload on `BACKLOG_BACKEND_PORT` and Vite UI on `BACKLOG_FRONTEND_PORT`, in the background (logs in `.run/`) |
| `./make.sh serve` | Builds the UI, then serves API, MCP and UI on `BACKLOG_BACKEND_PORT`, in the background |
| `./make.sh stop` | Stops what `dev`, `serve` or `up` started locally |
| `./make.sh build` | Builds the UI into `frontend/dist` |
| `./make.sh test` | Backend tests (`pytest`), then a UI build |
| `./make.sh backup` | Copies the local database to `~/.backlog/backups/` with the SQLite backup API, checks the copy, keeps the newest 14 |
| `./make.sh token NAME` | Prints a new MCP token line for client `NAME` |
| `./make.sh up`, `down`, `logs` | Runs the container (`compose.yml`) with data in `./data` |
| `./make.sh deploy [--dry-run] ACTION` | Works on the server through the shared [ops/app-deploy.sh](../foundation/ops/app-deploy.sh), with `APP_SERVICE=backlog` because the service is not named after the folder. Actions: `all`, `build`, `ship`, `sync`, `up`, `status`, `install-backup`, `backup`, `fetch-backup` |

## Configuration

Settings are environment variables with the prefix `BACKLOG_` ([backend/app/config.py](backend/app/config.py)). Development defaults are in [.env.dev](.env.dev), container settings in [.env.prod](.env.prod). Secrets go in `.env.prod.secrets` on the server, never committed.

| Variable | Meaning | Default |
|----------|---------|---------|
| `BACKLOG_DATA_DIR` | Folder of the SQLite file `backlog.sqlite3` | `~/.backlog/data`; `/data` in the container |
| `BACKLOG_STATIC_DIR` | Built UI served at `/` (unset in `dev`, where Vite serves it) | unset; `/srv/static` in the container |
| `BACKLOG_PORT` | Container port | `8000` |
| `BACKLOG_BACKEND_PORT` | Local API port used by `make.sh` and the Vite proxy | `8001` (`.env.dev`) |
| `BACKLOG_FRONTEND_PORT` | Vite dev server port | `5173` (`.env.dev`) |
| `BACKLOG_MCP_TOKENS` | Secret. One token per client: `claude-code:<token>,other:<token>` | not set |
| `BACKLOG_MCP_ALLOWED_HOSTS`, `BACKLOG_MCP_ALLOWED_ORIGINS` | `Host` and `Origin` values the MCP endpoint accepts | local addresses; see `.env.prod` |
| `BACKLOG_OAUTH_ISSUER`, `BACKLOG_OAUTH_RESOURCE`, `BACKLOG_OAUTH_JWKS_URL` | OAuth through Authelia; off when the issuer is empty | off; set in `.env.prod` |
| `BACKLOG_BACKUP_DIR` | `make.sh backup` only: where local copies go | `~/.backlog/backups` |

With neither tokens nor OAuth, the MCP endpoint refuses every request.

## Data stored

One SQLite database, `backlog.sqlite3`: `~/.backlog/data/` locally, `/data/` in the container (server folder `/opt/pa/backlog-manager/data`). The schema is created and upgraded at startup by plain SQL in `backend/app/migrations.py`. The tables are described in [docs/model.md](docs/model.md): projects, releases, items, notes and scratchpads.

## MCP clients

The endpoint is `/mcp` locally (`http://127.0.0.1:8001/mcp`) and `https://seansoul.gr/bm/mcp` through the gateway. The old stdio MCP server (`mcp_server/`, which could create, update and delete without confirmation) has been removed; point every client at `/bm/mcp`.

- Per-client tokens: `Authorization: Bearer <token>`. Create one with `./make.sh token claude-code` and add the line to `BACKLOG_MCP_TOKENS` in `.env.prod.secrets` (or the local environment). Each call is logged with the client name and tool name, not the content.
- OAuth: `Deployed`. Claude on the web and in the app connects with a token from the owner's Authelia login (`mcp_oauth.py`).
- Writes need your confirmation ([PRINCIPLES.md](../foundation/PRINCIPLES.md#mcp-access)). A write tool called without `confirm` saves nothing and returns the exact change and a `confirm` code; after your yes it is called again with the code, which is bound to those arguments and expires after 15 minutes. Keep the write tools off any auto-allow list.

Claude Code example:

```bash
claude mcp add --transport http backlog https://seansoul.gr/bm/mcp --header "Authorization: Bearer <token>"
```

## Deployment

`Deployed`; the deployed commit is `Not verified`. The server runs one container `backlog` on the `pa-edge` network (`backlog:8000`), reached by the gateway at `/bm/`, in `/opt/pa/backlog-manager/`. Deploy with `./make.sh deploy all` (build, ship, sync, up, status); try any action with `--dry-run` first.

## Backup and restore

Server side (the database is `/data/backlog.sqlite3` in the container):

1. `./make.sh deploy install-backup` adds the nightly backup (03:30 server time) to root's crontab, once. It is installed (checked 2026-10-27).
2. `./make.sh deploy backup` runs a backup now.
3. `./make.sh deploy fetch-backup` downloads the newest one to `data/backups/server/`.
4. `python3 ../foundation/ops/sqlite-restore-check.py data/backups/server/<file>` checks that the copy opens and passes the integrity check.

The server uses the shared `ops/app-backup.sh` (checked 2026-10-27). The older `ops/backlog-manager-backup.sh`, which wrote inside the container where `/backups` is not mounted, is no longer in the crontab and is removed from the foundation.

Local side: `./make.sh backup` writes `~/.backlog/backups/backlog-<timestamp>.sqlite3`, using the SQLite backup API (safe with the WAL file), runs `PRAGMA integrity_check` on the copy, and keeps the newest 14. Run it before a schema change.

Restore a local copy (replaces the live database; keep the old file until you are sure):

```bash
./make.sh stop
python3 ../foundation/ops/sqlite-restore-check.py ~/.backlog/backups/backlog-<timestamp>.sqlite3
mv ~/.backlog/data/backlog.sqlite3 ~/.backlog/data/backlog.sqlite3.old
rm -f ~/.backlog/data/backlog.sqlite3-wal ~/.backlog/data/backlog.sqlite3-shm
cp ~/.backlog/backups/backlog-<timestamp>.sqlite3 ~/.backlog/data/backlog.sqlite3
./make.sh serve
```

If the database will not open, check it with `sqlite3 ~/.backlog/data/backlog.sqlite3 "PRAGMA integrity_check;"` (read-only), and restore from the newest good copy. Only as a last resort, with no usable copy, move the file aside as above and start the application: it creates a fresh empty schema. Startup logs are in `.run/` after `dev` or `serve`. A restore on the server is a manual procedure and is `Not implemented` as a make.sh action.

## Repository structure

```text
backend/    FastAPI application (package app), tests, uv project
frontend/   Vue 3 + Vite UI, built to frontend/dist
docs/       architecture, data model, prototypes
tools/      import_backlog.py, one-off import script
Dockerfile, compose.yml, make.sh, .env.dev, .env.prod
```
