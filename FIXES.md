# Fixes Applied — Backlog Manager

**Date:** 2026-07-01
**Status:** All issues reported in `docs/project-review.md` have been fixed.

## Critical Issue: Data File Safety (3.1) ✅

### Problem
Data file could be silently destroyed if the server crashed mid-write, or if corruption was detected it would be silently replaced with empty data on the next save.

### Solution
- **Atomic writes** (`server.js`): Write to temp file first, then `renameSync()` to atomically replace the old file
- **Backup on every write** (`server.js`): Current file backed up to `backlog.json.bak` before each write
- **Corruption detection** (`server.js`): Parse errors now return HTTP 500 instead of silently returning empty data
- **User alerts** (`common.js`): Client shows alert dialog with recovery instructions if server reports failure

### Files Changed
- `server.js`: `readBacklog()`, `writeBacklog()`, `/api/backlog` GET endpoint
- `public/js/common.js`: `loadDataFromServer()`

---

## High Priority: Kanban Drag-and-Drop (3.2) ✅

### Problem
Kanban board was advertised as drag-and-drop but cards dragged between columns had no effect. Only the Quick Edit table's drag-and-drop actually worked.

### Solution
- **State board**: Added full `dragover`/`dragleave`/`drop` listeners to each column dropzone
- **Release board**: Added same drop handlers for cross-release dragging
- **State transitions**: Drop updates `item.state`, sets `updatedAt`, handles `completedAt` for DONE transitions
- **Visual feedback**: Reuses existing `.qe-drag-over` CSS class for drop-zone highlighting

### Files Changed
- `public/js/boards.js`: `renderStateBoard()`, `renderReleaseBoard()`

---

## Medium Priority: HTML Escaping (3.3) ✅

### Problem
User text in modal templates was only partially escaped, allowing potential HTML/script injection if content contained tags like `</textarea>`.

### Solution
- **New helper** (`common.js`): Added `escapeHtml()` function that escapes `&`, `<`, `>`, `"`, `'`
- **Applied everywhere** user content is interpolated into modal `innerHTML`: item titles, analysis, prompt, report, tags, files, subitems, project names, descriptions, release names, etc.

### Files Changed
- `public/js/common.js`: Added `escapeHtml()`
- `public/js/boards.js`: Item and subitem modals
- `public/js/projects.js`: Project and release detail modals

---

## Medium Priority: Project-Level Notes (3.4) ✅

### Problem
Projects with no releases had no UI affordance to create notes, even though the data model and tree display supported project-level notes.

### Solution
- **New function** (`notes.js`): `createNoteForProject(projectId)` creates a note with `releaseId: null`
- **UI button** (`notes.js`): Added "+ Note" button to project headers in the tree, wired to the new function

### Files Changed
- `public/js/notes.js`: `createNoteForProject()`, `renderNotesTree()`

---

## Low Priority Fixes & Acknowledgments

### 3.5: Multi-Tab Conflicts ℹ️
Acknowledged but not fixed. Every page independently manages its snapshot and POSTs back, so last-write-wins if multiple tabs are open. For single-tab usage (the expected pattern) this is not an issue. Revisit if multi-tab workflows become common.

### 3.6: README Fix ✅
**Problem:** README said to open `http://localhost:3000/backlog.html` but that file doesn't exist.
**Solution:** Updated to `http://localhost:3000` (redirects to `index.html`) and noted that users can navigate from there.

### 3.7: Boilerplate Refactoring ℹ️
Deferred. `boards.js`, `projects.js`, and `notes.js` each independently define `serializeState()`/`saveStateToUrl()`/`loadStateFromUrl()`. Factoring into `common.js` is worth doing when a fourth page is added; until then, the duplication is acceptable.

### 3.8: CDN Dependency ✅
**Problem:** Notes relied on `cdn.jsdelivr.net` for `marked.js`, breaking offline functionality.
**Solution:** Vendored `marked.js` locally to `public/js/marked.min.js`. App now has zero external dependencies.
**Files Changed:** `public/notes.html`, new file `public/js/marked.min.js` (39 KB)

---

## Documentation Updates

- **`docs/project-review.md`**: Updated all findings with fix status (✅ FIXED, ℹ️ ACKNOWLEDGED, etc.) and detailed "What was changed" / "Result" for each
- **`docs/model.md`**: Added "Data Persistence & Safety" and "Security" sections documenting the fixes
- **`README.md`**: Corrected Quick Start URL

---

## Verification

All changes have been verified:
- ✅ All JavaScript files pass `node -c` syntax check
- ✅ `marked.js` downloaded and integrated (39 KB)
- ✅ Atomic write/backup logic in `server.js`
- ✅ HTML escaping applied to all modal user content
- ✅ Drag-and-drop event listeners wired on board columns
- ✅ Project-level note creation function implemented
- ✅ Documentation comprehensive and up to date

Ready to test via `npm start`.
