# Architecture of Backlog Manager

Status: `Implemented`. Moved from AGENTS.md; see [README.md](../README.md) for commands and configuration.

## Backend (`backend/`, Python / FastAPI)

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
    mcp_server.py / mcp_oauth.py  # MCP endpoint at /mcp: tokens or Authelia OAuth; two-step writes
  requirements.txt             # Pinned deps for plain `pip install -r requirements.txt` (generated via `uv export`)
  pyproject.toml                # Source of truth for deps; managed with `uv`
```

Endpoints mirror the original REST design: `GET/POST/PATCH/DELETE` on `/api/projects`, `/api/releases`, `/api/items`, `/api/notes`, `/api/scratchpads/:type`, plus `GET /api/config` and `GET /api/backlog` (aggregate snapshot for initial page load).

Key safety measures:
- **SQLite with WAL mode**: enabled via an SQLAlchemy `connect` event listener
- **Foreign key constraints**: enforced via `PRAGMA foreign_keys = ON`, cascade deletes match the old schema (project→releases/items/notes cascade; release→items SET NULL, release→notes cascade)
- **Plain SQL migrations**: `backend/app/migrations.py` creates and upgrades the schema, called from the `lifespan` in `main.py` at startup; each change is guarded so it runs only when the table or column is missing
- **Typed errors**: repositories raise `NotFoundError`/`ConflictError` (`app/errors.py`), translated to HTTP 404/400 by exception handlers in `main.py`

## Frontend (`frontend/`, Vue 3 + Vite)

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

## Data Flow

1. **Load**: `App.vue` calls `useBacklogStore().loadAll()` once on mount, fetching `/api/config` and `/api/backlog` in parallel. The reactive store then lives in memory for the whole SPA session — navigating between Boards/Projects/Notes does **not** refetch or reload (this is the main win of the SPA rewrite: no more sessionStorage-cache dance to fake instant navigation across full page reloads).
2. **Edit**: Components mutate the shared reactive store directly (optimistic update), then call the matching `services/*.service.js` function.
3. **Sync**: `useBacklogStore().syncMutation()` wraps each write; on failure it shows a toast and reloads authoritative state from the server so a dropped request can't leave the UI silently diverged from disk (same pattern as the old `syncMutation()` in `common.js`).
4. **Persist**: FastAPI → repository → SQLAlchemy session, committed per-request by `get_db()`.

**Key patterns**:
- REST API model: each resource has dedicated endpoints, unchanged in shape from the original app
- Last-write-wins: single-tab usage is intended
- Bookmarkable view state: each page's local UI state (view mode, selected project, quick-edit toggle, etc.) is synced to the URL query string via `router.replace({ query })`, mirroring the original per-page `serializeState()`/`loadStateFromUrl()` pattern

## Important Patterns

## Item Details Modal

`components/boards/ItemDetailModal.vue` is a dedicated Vue component (not the old raw-HTML-string `bodyHtml` injected into a generic modal) covering title, state, priority, type, tags, files, analysis, prompt, report, and subitems. Tags use `TagInput.vue` (comma-separated text + autocomplete dropdown); subitems use `SubitemsEditor.vue`.

## Quick Edit Table

Same UX as before: double-click a title cell to edit, Enter commits, Tab commits + moves to the next row, Esc cancels, rows are draggable within/across groups. Implemented in `QuickEditGroup.vue` (one group's table + its own editing/drag state) wrapped by `QuickEditTable.vue`.

## Drag-and-drop reordering

`components/projects/ManageList.vue` reimplements the old vanilla-JS "insert before closest element" drag algorithm, but reorders a local reactive `id` array instead of manually moving DOM nodes — Vue re-renders the list in the new order, avoiding any conflict between manual DOM mutation and Vue's virtual DOM.

## Markdown rendering

Notes and the note preview use the npm `marked` package (replacing the vendored `marked.min.js`), rendered via `v-html` — same trust model as before (single-user local app, no sanitization, matches the original's direct `innerHTML = marked.parse(...)`).

## Key files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app, lifespan (migrations + seeding), exception handlers, SPA serving |
| `backend/app/db.py` | Engine/session setup, WAL + foreign_keys pragmas |
| `backend/app/models/*.py` | SQLAlchemy ORM models |
| `backend/app/routers/*.py` | HTTP endpoints per resource |
| `backend/app/repositories/*.py` | Query/persistence logic per resource |
| `backend/app/migrations.py` | Plain SQL schema and migrations |
| `backend/app/mcp_server.py` | MCP tools, two-step confirm |
| `frontend/src/composables/useBacklogStore.js` | Shared reactive state, load/sync/filter logic |
| `frontend/src/views/BoardsPage.vue` | Kanban boards, quick edit, drag-and-drop, modal wiring |
| `frontend/src/views/ProjectsPage.vue` | Project/release management |
| `frontend/src/views/NotesPage.vue` | Notes tree, markdown editor, scratchpad |
| `frontend/src/assets/*.css` | Ported CSS — theme variables, shared UI |
| `make.sh` | Every run, test, backup and deploy action |
