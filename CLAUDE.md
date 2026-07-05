# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ AGENTIC SAFETY: READ FIRST

**This is a production app with live local data at `~/.backlog/data/backlog.sqlite3`**

**AGENTS MUST FOLLOW THESE RULES:**
1. **Never execute database operations** — No migrations, no restores, no direct file modifications
2. **Never run shell commands that modify data** — No `sqlite3` writes, no editing the `.sqlite3`/`-wal`/`-shm` files directly
3. **Create migration scripts, don't execute them** — Write Alembic migrations under `backend/alembic/versions/` and show them in a commit, but the user runs `alembic upgrade head` (or restarts the app, which runs migrations automatically — see "Database Schema Changes" below)
4. **Use APIs for testing** — Read data via `GET` endpoints only; no direct database access
5. **Respect the local state** — Assume the database is valid and in-use. Don't "fix" it without asking

**If you break these rules, you will corrupt the user's backlog data. Don't do it.**

## Project Overview

**Backlog Manager** is a local-first backlog management web app. It's a single-page app (SPA) with a clean UI/backend split: a **Vue 3 + Vite** frontend talks to a **Python/FastAPI** REST backend, which persists to SQLite via SQLAlchemy.

**Key features:**
- Kanban boards: state-based (BACKLOG/TODO/ONGOING/DONE) or release-based columns
- Quick Edit mode: inline title editing with Tab-to-next-row navigation
- Projects & Releases: organize items into projects and release cycles
- Notes: Markdown-supported project notes, plus a per-project-type scratchpad
- Two project types: "work" and "argonath" (toggleable via header)
- Drag-and-drop: reorder items within boards or move between states/releases
- Archival: DONE items older than 7 days auto-hide, viewable in archive panel

## Running the App

**Development** (backend + Vite dev server, hot reload):
```bash
./start.sh              # starts backend (:8000) and frontend (:5173) in background
open http://localhost:5173
./stop.sh
```

**Single-server / production-like** (frontend built and served by the backend on one port):
```bash
./serve.sh              # builds frontend, starts backend serving it on :3000
open http://localhost:3000
./stop.sh
```

The backend defaults to storing data at `~/.backlog/data/backlog.sqlite3`. Override via `BACKLOG_DATA_DIR` env var. Backend port via `BACKLOG_BACKEND_PORT` (dev) or `PORT` (serve.sh); frontend dev port via `BACKLOG_FRONTEND_PORT`.

**If data is lost or corrupted**, see [RECOVERY.md](RECOVERY.md) for restoration instructions.

## Architecture

### Backend (`backend/`, Python / FastAPI)

```
backend/
  app/
    main.py            # FastAPI app, lifespan (initializes schema + seeds scratchpads), exception handlers, SPA static/fallback serving
    config.py           # Settings: data dir, db filename, ports (pydantic-settings, BACKLOG_ env prefix)
    db.py                # SQLAlchemy engine/session, Base, get_db dependency (session-per-request = the TX boundary)
    models/               # ORM models: Project, Release, Item, Note, Scratchpad
    schemas/               # Pydantic Create/Update/Out models per resource (camelCase JSON via alias_generator, snake_case Python)
    routers/                # Thin HTTP layer, one router per resource + backlog.py (aggregate read)
    repositories/            # Query/persistence logic per resource, called by routers
    migrations.py           # Plain SQL schema initialization (no Alembic)
  requirements.txt             # Pinned deps for plain `pip install -r requirements.txt` (generated via `uv export`)
  pyproject.toml                # Source of truth for deps; managed with `uv`
```

Endpoints mirror the original REST design: `GET/POST/PATCH/DELETE` on `/api/projects`, `/api/releases`, `/api/items`, `/api/notes`, `/api/scratchpads/:type`, plus `GET /api/config` and `GET /api/backlog` (aggregate snapshot for initial page load).

Key safety measures:
- **SQLite with WAL mode**: enabled via an SQLAlchemy `connect` event listener
- **Foreign key constraints**: enforced via `PRAGMA foreign_keys = ON`, cascade deletes match the old schema (project→releases/items/notes cascade; release→items SET NULL, release→notes cascade)
- **Alembic migrations**: schema changes are versioned scripts under `backend/alembic/versions/`, applied automatically at app startup via `command.upgrade(cfg, "head")` in `main.py` — the same "reviewed code runs the migration" pattern as before, just via Alembic instead of a hand-rolled `migrateDB()`
- **Typed errors**: repositories raise `NotFoundError`/`ConflictError` (`app/errors.py`), translated to HTTP 404/400 by exception handlers in `main.py`

### Frontend (`frontend/`, Vue 3 + Vite)

```
frontend/
  src/
    main.js / App.vue        # App shell: header, router-view, status bar, global Modal/Toast
    router/index.js           # vue-router: /, /boards, /projects, /notes (lazy-loaded, no full page reload between them)
    composables/                # Shared reactive state, singleton pattern (not Pinia):
                                 #   useBacklogStore.js — projects/items/notes/scratchpads/config, filters, mutation helper
                                 #   useModal.js / useToast.js — generic prompt/confirm dialog and toast notifications
    services/                    # axios wrapper (client.js) + one module per resource (items.service.js, etc.)
    components/
      common/                    # Modal.vue, Toast.vue
      layout/                     # AppHeader.vue, StatusBar.vue
      boards/                      # BoardColumn, ItemCard, QuickEditTable/Group, ArchivePanel, ItemDetailModal, AddItemModal, PriorityRadios, TypeRadios, TagInput, SubitemsEditor
      projects/                     # ManageList (generic reorderable list), AddProjectModal, ProjectDetailModal, ReleaseDetailModal
      notes/                         # NotesTree, ConvertScratchpadModal
    views/
      BoardsPage.vue / ProjectsPage.vue / NotesPage.vue / HomePage.vue
    assets/                          # common.css / boards.css / projects.css / notes.css — ported verbatim from the original app for identical look and feel
```

### Data Flow

1. **Load**: `App.vue` calls `useBacklogStore().loadAll()` once on mount, fetching `/api/config` and `/api/backlog` in parallel. The reactive store then lives in memory for the whole SPA session — navigating between Boards/Projects/Notes does **not** refetch or reload (this is the main win of the SPA rewrite: no more sessionStorage-cache dance to fake instant navigation across full page reloads).
2. **Edit**: Components mutate the shared reactive store directly (optimistic update), then call the matching `services/*.service.js` function.
3. **Sync**: `useBacklogStore().syncMutation()` wraps each write; on failure it shows a toast and reloads authoritative state from the server so a dropped request can't leave the UI silently diverged from disk (same pattern as the old `syncMutation()` in `common.js`).
4. **Persist**: FastAPI → repository → SQLAlchemy session, committed per-request by `get_db()`.

**Key patterns**:
- REST API model: each resource has dedicated endpoints, unchanged in shape from the original app
- Last-write-wins: single-tab usage is intended
- Bookmarkable view state: each page's local UI state (view mode, selected project, quick-edit toggle, etc.) is synced to the URL query string via `router.replace({ query })`, mirroring the original per-page `serializeState()`/`loadStateFromUrl()` pattern

## Important Patterns

### Item Details Modal

`components/boards/ItemDetailModal.vue` is a dedicated Vue component (not the old raw-HTML-string `bodyHtml` injected into a generic modal) covering title, state, priority, type, tags, files, analysis, prompt, report, and subitems. Tags use `TagInput.vue` (comma-separated text + autocomplete dropdown); subitems use `SubitemsEditor.vue`.

### Quick Edit Table

Same UX as before: double-click a title cell to edit, Enter commits, Tab commits + moves to the next row, Esc cancels, rows are draggable within/across groups. Implemented in `QuickEditGroup.vue` (one group's table + its own editing/drag state) wrapped by `QuickEditTable.vue`.

### Drag-and-drop reordering

`components/projects/ManageList.vue` reimplements the old vanilla-JS "insert before closest element" drag algorithm, but reorders a local reactive `id` array instead of manually moving DOM nodes — Vue re-renders the list in the new order, avoiding any conflict between manual DOM mutation and Vue's virtual DOM.

### Markdown rendering

Notes and the note preview use the npm `marked` package (replacing the vendored `marked.min.js`), rendered via `v-html` — same trust model as before (single-user local app, no sanitization, matches the original's direct `innerHTML = marked.parse(...)`).

## Common Tasks

### Add a new field to items

1. Add the column to the `Item` model in `backend/app/models/item.py`
2. Add it to `ItemCreate`/`ItemUpdate`/`ItemOut` in `backend/app/schemas/item.py`
3. Generate a migration: `cd backend && uv run alembic revision --autogenerate -m "add X to items"` — review the generated script under `alembic/versions/`, don't hand-run it against the live DB without the user's OK
4. Update `item_to_out()` in `backend/app/repositories/item_repo.py` if the field needs JSON (de)serialization
5. Add the field to `ItemDetailModal.vue` / `AddItemModal.vue`, and to `QuickEditGroup.vue`'s columns if it should show in Quick Edit

### Modify the Quick Edit table columns

Edit `frontend/src/components/boards/QuickEditGroup.vue`: the `<thead>` columns and the matching `<td>`s in the row loop, plus `columnCount()` for the empty-state colspan.

### Change data storage location

```bash
BACKLOG_DATA_DIR=/custom/path ./start.sh
```

### Debug data corruption

See [RECOVERY.md](RECOVERY.md). In short: check backend logs (`/tmp/backlog-manager-backend.log` or `/tmp/backlog-manager.log`), check `~/.backlog/backups/` for a `backup.sh` snapshot, use `sqlite3 ... "PRAGMA integrity_check;"` to diagnose — never write to the file directly.

### Add a new page

1. Create `frontend/src/views/PageName.vue`
2. Register it in `frontend/src/router/index.js` (lazy import)
3. Link from `AppHeader.vue`'s nav pills
4. Use `useBacklogStore()` for shared data and `useModal()`/`useToast()` for dialogs/notifications — no new global wiring needed

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app, lifespan (migrations + seeding), exception handlers, SPA serving |
| `backend/app/db.py` | Engine/session setup, WAL + foreign_keys pragmas |
| `backend/app/models/*.py` | SQLAlchemy ORM models |
| `backend/app/routers/*.py` | HTTP endpoints per resource |
| `backend/app/repositories/*.py` | Query/persistence logic per resource |
| `backend/alembic/versions/*.py` | Migration history |
| `frontend/src/composables/useBacklogStore.js` | Shared reactive state, load/sync/filter logic |
| `frontend/src/views/BoardsPage.vue` | Kanban boards, quick edit, drag-and-drop, modal wiring |
| `frontend/src/views/ProjectsPage.vue` | Project/release management |
| `frontend/src/views/NotesPage.vue` | Notes tree, markdown editor, scratchpad |
| `frontend/src/assets/*.css` | Ported CSS — theme variables, shared UI |
| `start.sh` / `stop.sh` / `serve.sh` | Dev (two processes) and single-server (one process) run scripts |

## Security Notes

- **HTML injection**: Vue templates auto-escape interpolated text by default; the one `v-html` usage (Markdown note preview) mirrors the original app's trust model (single-user, local, no sanitization)
- **No auth**: Single-user, file-access model. Assume filesystem permissions handle isolation
- **No input validation beyond Pydantic's type/shape checks**: business-rule validation (e.g. non-empty titles) happens client-side and in a few repository checks, not exhaustively
- **No CSRF protection**: single-user app, no session management

## Testing Tips

- **Quick test flow**: `./start.sh`, open the frontend, create a test project (Projects page), add items (Boards page), toggle Quick Edit mode, drag items between states
- **API smoke test**: `curl http://localhost:8000/api/backlog | python3 -m json.tool`
- **Data safety**: kill the backend mid-write and confirm SQLite WAL recovers cleanly on restart
- **Multi-tab**: open two tabs and edit simultaneously; verify last-write-wins behavior

## Notes on Maintenance

- No test suite (review the code carefully)
- Frontend has a build step (`npm run build` via Vite); backend has none (Python runs as-is)
- No linting config (watch for consistent spacing/naming)
- `marked` is an npm dependency now (not vendored); check for security updates periodically

## Database Schema Changes

⚠️ **CRITICAL: AGENTS MUST NOT EXECUTE SCHEMA CHANGES AGAINST THE LIVE DATABASE**

When schema changes are needed:

1. **Update the SQLAlchemy model(s)** in `backend/app/models/`
2. **Update the schema** in `backend/app/migrations.py` — add the SQL `CREATE TABLE` / `ALTER TABLE` statements to the `init_db()` function's SQL script
3. **Add a conditional check** so the schema change only runs if that table/column doesn't already exist (the function already checks for existing tables and returns early if found)
4. **Document in the commit message** what the schema change does and why
5. **The app automatically applies schema on startup** via `main.py`'s `lifespan` calling `init_db()`, which the user triggers by starting the app after reviewing your changes

**Why this matters**: The local database is live data. Only the user decides when a reviewed change actually runs against it.

## Data Safety Rules for Agents

1. **Read-only database access**: use API endpoints (`GET` requests) to inspect data, not direct SQLite access
2. **Never modify local files directly**: no hand-written `db.execute()`/`sqlite3` writes, no editing `~/.backlog/data/backlog.sqlite3` or its `-wal`/`-shm` files
3. **Test migrations in isolation**: point `BACKLOG_DATA_DIR` at a throwaway directory when developing/testing a migration; only the user runs it against the real data dir
4. **Ask for user confirmation** before any schema change is applied to the real database
