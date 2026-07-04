# Backlog Manager

A local-first backlog management app with a kanban-style board, release tracking, and quick-edit title mode.

**Stack:** Python/FastAPI + SQLAlchemy ORM + Alembic (backend), Vue 3 + Vite SPA (frontend), SQLite storage.

## Quick Start (development)

```bash
./start.sh
```

This starts the backend (FastAPI on port 8000) and frontend (Vite dev server on port 5173, proxying `/api` to the backend) in the background. Open [http://localhost:5173](http://localhost:5173).

Stop both with `./stop.sh`.

### Manual dev setup

```bash
# Backend
cd backend
uv sync                 # or: pip install -r requirements.txt
uv run uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Quick Start (single-server / production-like)

```bash
./serve.sh
```

Builds the frontend and serves it from the FastAPI backend as a single process on one port (default 3000) — no separate dev server. Open [http://localhost:3000](http://localhost:3000). Stop with `./stop.sh`.

## Data Storage

All backlog data is stored in a local SQLite database at `~/.backlog/data/backlog.sqlite3` (override with `BACKLOG_DATA_DIR`). The file and schema are created automatically on first run via Alembic migrations. No external database service is required.

## Usage

- **Boards** — State-based kanban (BACKLOG / TODO / ONGOING / DONE) or Release-based columns.
- **Quick Edit** — Toggle to edit item titles inline with double-click, TAB navigation, and drag-to-reorder within and across lists.
- **Projects & Releases** — Add, edit, and delete projects and their releases.
- **Notes** — Per-project Markdown notes plus a quick-capture scratchpad, one per Work/Argonath project type.
- The app is a single-page app: navigating between Boards/Projects/Notes doesn't reload the page.
