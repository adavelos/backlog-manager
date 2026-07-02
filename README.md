# Backlog Manager

A local-first backlog management app with a kanban-style board, release tracking, and quick-edit title mode.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser, then navigate to Boards, Projects, or Notes.

## Data Storage

All backlog data is stored in a local JSON file at `data/backlog.json`. The file is created automatically on first save. No database or external service is required.

## Usage

- **Boards** — State-based kanban (BACKLOG / TODO / ONGOING / DONE) or Release-based columns.
- **Quick Edit** — Toggle to edit item titles inline with double-click, TAB navigation, and drag-to-reorder within and across lists.
- **Projects & Releases** — Add, edit, and delete projects and their releases.
- Data persists across page reloads via the JSON API.
