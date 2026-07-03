# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ AGENTIC SAFETY: READ FIRST

**This is a production app with live local data at `~/.backlog/data/backlog.db`**

**AGENTS MUST FOLLOW THESE RULES:**
1. **Never execute database operations** — No migrations, no restores, no file modifications
2. **Never run shell commands that modify data** — No `node restore-from-json.js`, no `sqlite3` writes
3. **Create migration scripts, don't execute them** — Write migration code in `server.js:migrateDB()` and show it in a commit, but the user runs it
4. **Use APIs for testing** — Read data via `GET` endpoints only; no direct database access
5. **Respect the local state** — Assume the database is valid and in-use. Don't "fix" it without asking

**If you break these rules, you will corrupt the user's backlog data. Don't do it.**

## Project Overview

**Backlog Manager** is a local-first backlog management web app. It's a single-user system with SQLite persistence at `~/.backlog/data/backlog.db`. A JSON backup (`backlog.json.bak`) is maintained for emergency recovery.

**Key features:**
- Kanban boards: state-based (BACKLOG/TODO/ONGOING/DONE) or release-based columns
- Quick Edit mode: inline title editing with Tab-to-next-row navigation
- Projects & Releases: organize items into projects and release cycles
- Notes: Markdown-supported project notes
- Two project types: "work" and "argonath" (toggleable via header)
- Drag-and-drop: reorder items within boards or move between states/releases
- Archival: DONE items older than 7 days auto-hide, viewable in archive panel

## Running the App

```bash
npm install              # One-time setup
npm start               # Starts Express server on port 3000
open http://localhost:3000
```

The server defaults to storing data at `~/.backlog/data/backlog.db`. Override via `BACKLOG_DATA_DIR` env var if needed.

Control via shell scripts:
```bash
./start.sh              # Start in background, saves PID to /tmp/backlog-manager.pid
./stop.sh               # Kill the background process
```

**If data is lost or corrupted**, see [RECOVERY.md](RECOVERY.md) for restoration instructions.

## Architecture

### Backend (Node.js / Express)

**`server.js`** — Express app with SQLite backend and RESTful endpoints:
- `GET /api/config` — Returns data directory and database file path
- `GET /api/backlog` — Full data snapshot (projects + items + notes) for initial page load
- `GET /api/projects` — List all projects with nested releases
- `POST/PATCH/DELETE /api/projects/:id` — Project management
- `POST/PATCH/DELETE /api/releases/:id` — Release management
- `GET/POST/PATCH/DELETE /api/items` — Item/backlog operations
- `POST/PATCH/DELETE /api/notes/:id` — Notes management
- `PATCH /api/scratchpads/:type` — Scratchpad updates (work/argonath)

Key safety measures:
- **SQLite with WAL mode**: Write-ahead logging for crash safety
- **Foreign key constraints**: Enforces data integrity (cascade deletes)
- **JSON backup**: `backlog.json.bak` kept for emergency recovery
- **Corruption detection**: Parse errors → HTTP 500, detailed logging
- Serves static files from `public/`

### Frontend (Vanilla JS)

**Three main pages**, each with its own directory structure:

1. **Boards** (`public/boards.html`, `public/js/boards.js`)
   - State board (kanban by BACKLOG/TODO/ONGOING/DONE)
   - Release board (kanban by project releases)
   - Quick Edit: table view with inline title editing, drag-to-reorder, double-click to edit
   - Archive panel: shows DONE items > 7 days old
   - Filters: project, tags, view mode (state/release/board/quick-edit)

2. **Projects** (`public/projects.html`, `public/js/projects.js`)
   - Manage projects (create/edit/delete)
   - Manage releases within each project
   - Project descriptions, release descriptions

3. **Notes** (`public/notes.html`, `public/js/notes.js`)
   - Tree view: projects → releases → notes
   - Markdown editor with preview
   - Project-level notes (no release required)
   - Vendored `marked.js` for offline support

**Shared Logic** (`public/js/common.js`)
- API calls: `loadDataFromServer()`, `saveDataToServer()`, `scheduleAutoSave()`
- Rendering: status bar, header type toggle, tag suggestions
- Modals: generic modal system with dynamic buttons
- Utilities: `escapeHtml()`, `generateId()`, `copyItemPromptToClipboard()`
- Data filtering: `getVisibleBoardItems()`, `getArchivedItems()`
- Global state: `data` (projects/items/notes), `config`, `activeProjectType` (work/argonath), filters

**CSS** (`public/css/`)
- `common.css`: Shared UI (header, modals, status bar, theme variables)
- `boards.css`: Kanban boards, quick-edit table, archive panel
- `projects.css`: Project/release management lists
- `notes.css`: Notes tree, editor, preview

### Data Flow

1. **Load**: On page load, `common.js` calls `loadDataFromServer()` which fetches `/api/backlog` (all projects, items, notes)
2. **Edit**: User modifies local in-memory `data` object (add/edit items, change state, etc.)
3. **Save**: Individual API calls (`POST /api/items`, `PATCH /api/items/:id`, etc.) update the database
4. **Persist**: Server writes to SQLite with WAL mode; JSON backup updated after each write
5. **UI**: Each page calls `renderAll()` to re-render after changes

**Key patterns**: 
- REST API model: Each resource (project, item, note) has dedicated endpoints
- Last-write-wins: If multiple tabs edit simultaneously, only the last write survives (single-tab usage is intended)
- JSON backup: Updated after every successful database write for emergency recovery

## Important Patterns

### URL State Serialization

Each page independently serializes its view state into the URL query string (for bookmarkability and back-button support):

```javascript
function serializeState() {
  const params = new URLSearchParams();
  if (view !== "state") params.set("view", view);
  if (currentProjectId !== "ALL") params.set("project", currentProjectId);
  // ...
  return params.toString();
}
```

This pattern is duplicated across `boards.js`, `projects.js`, `notes.js`. Consider factoring to `common.js` if a fourth page is added.

### Item Details Modal

Item editing (title, state, priority, type, tags, files, analysis, prompt, report, subitems) happens in a unified modal opened by `openItemDetail(itemId)`. Uses `escapeHtml()` on all user text to prevent injection.

### Quick Edit Table

Inline editing workflow:
1. Double-click title cell to enter edit mode
2. **Enter** commits the change
3. **Tab** commits and moves to next row
4. **Esc** cancels
5. Rows are draggable: drag to reorder within group or move to another group (state/release)

### Tag Suggestions

`setupTagSuggestions(inputId, suggestionsId)` wires tag autocompletion (search-as-you-type) based on existing tags in the data.

### State Transitions

- Moving item to **DONE** sets `completedAt = Date.now()`
- Moving item away from **DONE** clears `completedAt`
- Items with `state === "DONE"` and `completedAt` > 7 days old are archived

## Common Tasks

### Add a new field to items

1. Update the item creation modal in `boards.js:addItem()` (add form field)
2. Update the item detail modal in `boards.js:openItemDetail()` (show/edit field)
3. Ensure all new item objects have the field initialized in `boards.js:addItem()` near line 1086
4. If the field should appear in Quick Edit table, add a column to `renderQuickEdit()` and update column widths

### Modify the Quick Edit table columns

Edit `boards.js:renderQuickEdit()`:
- Update `columns` array (line 360–362)
- Add/remove table cells in the row rendering loop
- Adjust `style.width` percentages to sum to 100%

### Change data storage location

Set `BACKLOG_DATA_DIR` env var before starting the server:
```bash
BACKLOG_DATA_DIR=/custom/path npm start
```

### Debug data corruption

If a server crash leaves corrupt JSON:
1. Check `server.js` console logs for parse errors
2. Look for `backlog.json.bak` (last-known-good backup)
3. Replace `backlog.json` with the backup manually if needed

### Add a new page

1. Create HTML in `public/page-name.html`
2. Create JS in `public/js/page-name.js` with:
   - Page-specific state and DOM refs
   - `serializeState()`, `saveStateToUrl()`, `loadStateFromUrl()`
   - `renderAll()` orchestrator
   - Event listeners wired at the bottom
3. Link from the header nav in `public/partials/header.html`
4. Page will auto-load global `data` and share the modal system

## Key Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Express app, file I/O, two JSON endpoints |
| `public/js/common.js` | Shared API, rendering, modals, utilities, global state |
| `public/js/boards.js` | Kanban boards, quick edit, item details (~1220 lines) |
| `public/js/projects.js` | Project/release management |
| `public/js/notes.js` | Notes tree, markdown editor |
| `public/js/marked.min.js` | Vendored Markdown parser (offline support) |
| `public/css/common.css` | Shared UI, theme variables (--text-muted, --cyan-50, etc.) |
| `public/index.html` | Home/landing page |
| `package.json` | Dependencies: Express only |
| `FIXES.md` | Detailed log of bug fixes and safety improvements |

## Security Notes

- **HTML injection**: All user text interpolated into `innerHTML` is passed through `escapeHtml()` (e.g., item titles in modals, project names, tag values)
- **No auth**: Single-user, file-access model. Assume filesystem permissions handle isolation
- **No input validation**: Items can have empty titles, releases can have empty names, etc. Validation happens client-side only
- **No CSRF protection**: Endpoints don't use CSRF tokens (single-user app, no session management)

## Testing Tips

- **Quick test flow**: Navigate to Boards, create a test project (Projects page), add items (Boards page), toggle Quick Edit mode, drag items between states
- **Data safety**: Intentionally crash the server mid-save to verify `backlog.json.bak` was created
- **Multi-tab**: Open two tabs and edit simultaneously; verify last-write-wins behavior
- **Archival**: Create a DONE item, advance system clock 8+ days, refresh page, check archive panel

## Notes on Maintenance

- No test suite (review the code carefully)
- No build step (serves static files as-is)
- No linting config (watch for consistent spacing/naming)
- `marked.js` is vendored; check for security updates periodically
- If you add more endpoints, keep the data model simple (projects + items + notes arrays)

## Database Schema Changes

⚠️ **CRITICAL: AGENTS MUST NOT EXECUTE SCHEMA CHANGES**

When schema changes are needed:

1. **Create the migration script** in `migrations/` with a timestamp prefix:
   ```
   migrations/001-add-column-to-items.sql
   migrations/002-create-index.sql
   ```

2. **Update `server.js:migrateDB()`** with the migration logic (do NOT execute):
   ```javascript
   async function migrateDB() {
     try {
       await dbRun("ALTER TABLE items ADD COLUMN newField TEXT");
       log.info('Migration: added newField to items');
     } catch (e) {
       if (!e.message.includes('duplicate column')) {
         log.warn('Migration error: ' + e.message);
       }
     }
   }
   ```

3. **Document in the commit message** what the migration does and why

4. **DO NOT EXECUTE** — User will test and run migrations manually

**Why this matters**: The local database is live production data. Only the user can run migrations after careful review and backup.

## ⚠️ DO NOT RESTORE FROM JSON

The `restore-from-json.js` script and `backlog.json.bak` file exist only for emergencies. **AGENTS MUST NEVER:**
- Call `restore-from-json.js`
- Modify `~/.backlog/data/`
- Delete or alter `backlog.db`, `backlog.db-wal`, or `backlog.db-shm`
- Read or write the actual database files

The JSON backup is outdated. Use it only if explicitly instructed by the user.

## Data Safety Rules for Agents

1. **Read-only database access**: Use API endpoints to read data (GET requests)
2. **Never modify local files**: No `fs.writeFileSync()`, no `db.run()` calls, no backup operations
3. **Test migrations in isolation**: Create and show migration scripts, but don't execute them
4. **Ask for user confirmation** before any database changes are committed to the codebase
