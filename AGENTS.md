# Agent Instructions

## Read first

- Stack rules, which every application follows: `/home/adavelos/pa/foundation/standards/STACK.md`.
- Principles for small applications: `/home/adavelos/pa/foundation/PRINCIPLES.md`.
- Status of this application in the plan: `/home/adavelos/pa/foundation/PLAN.md`.

If a rule here conflicts with those files, the foundation files win, and this file must be corrected.

## This application

- Name: Backlog Manager
- Purpose: the owner's backlog of projects, releases and items, as kanban boards, quick edit and notes.
- Owner-only, or serves several people: owner-only.
- Public path prefix: `/bm/` (the MCP endpoint is `/bm/mcp`).
- Port inside the container: 8000, read from `BACKLOG_PORT`. Locally, `.env.dev` sets API 8001 and Vite 5173.
- Names on the server: service and container `backlog`, folder `/opt/pa/backlog-manager`, database `/data/backlog.sqlite3`.
- Architecture, patterns and key files: [docs/architecture.md](docs/architecture.md). Data model: [docs/model.md](docs/model.md). REST API: [API_SPEC.md](API_SPEC.md). Everything the owner needs to run it: [README.md](README.md).

## Commands

`./make.sh` is the single entry point (`./make.sh help` lists everything).

- Start: `./make.sh dev` (hot reload) or `./make.sh serve` (one process, built UI)
- Stop: `./make.sh stop`
- Test: `./make.sh test`
- Backup: `./make.sh backup` (local copy); on the server `./make.sh deploy backup`
- Deploy: `./make.sh deploy <action>`. Agents do not run deploy actions unless the owner asks.

## Rules for agents

- Use the stack in `STACK.md`. Any other choice needs a reason written in this application's README.
- Frontends use relative links, never root-absolute ones.
- MCP write tools: before any change, show the owner what will change and get their confirmation (preview, then confirm; see `PRINCIPLES.md`, MCP access). Never pass a confirm code the owner has not approved. There is no delete tool and none may be added without the owner's decision.
- Bind only to `127.0.0.1` or the Docker network.
- Never commit secrets. Keep them in `*.secrets`.
- Test locally or on a spare port before changing ports 80 or 443.
- Markdown files follow the `project-documentation` rules: status labels, verified facts, and no invented behaviour.

### Data safety (the local database is live data)

The local database is `~/.backlog/data/backlog.sqlite3` (override with `BACKLOG_DATA_DIR`).

1. Never write to the database or its `-wal`/`-shm` files directly, and never run a restore.
2. Read data through `GET` endpoints. Run tests only against the throwaway folder `backend/.test-data` (`conftest.py` does this).
3. The schema is plain SQL in `backend/app/migrations.py` (there is no Alembic). A schema change updates the SQLAlchemy model in `backend/app/models/` and adds a guarded statement (runs only when the table or column is missing) to `migrations.py`. The app applies it at startup, which the owner triggers after reviewing the change. Describe the schema change in the commit message.
4. Ask the owner before any change is applied to the real database.
5. Run `./make.sh backup` before any risky operation, and tell the owner.

### Common tasks

- New item field: model (`backend/app/models/item.py`), schemas (`backend/app/schemas/item.py`), a guarded `ALTER TABLE` in `migrations.py`, `item_to_out()` in `backend/app/repositories/item_repo.py` if it needs JSON conversion, then the Vue modals and `QuickEditGroup.vue`.
- New page: view in `frontend/src/views/`, lazy route in `frontend/src/router/index.js`, link in `AppHeader.vue`.
- Details of each pattern: [docs/architecture.md](docs/architecture.md).
