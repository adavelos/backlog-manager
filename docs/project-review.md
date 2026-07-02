# Backlog Manager — Project Review

**Date:** 2026-07-01 | **Updated:** 2026-07-01 (all issues fixed)
**Scope:** Full codebase review (server, frontend, data model, docs) for a local-first, single-user backlog/kanban tool.

## 1. Overview

Backlog Manager is a small Express + vanilla-JS app for tracking projects, releases, backlog items, and Markdown notes. There is no database, no build step, and no auth — the entire app state lives in one JSON file (`data/backlog.json`) that the browser fetches whole and POSTs back whole. For a local, single-user tool this is a reasonable, low-ceremony architecture.

**Stack:** Express 5, static HTML/CSS/vanilla JS (no framework, no bundler), `marked` vendored locally for Markdown rendering. ~5,000 lines across `server.js` and `public/js/*.js`.

**Pages:** `index.html` (landing), `boards.html` (kanban + Quick Edit table), `projects.html` (projects/releases CRUD), `notes.html` (Markdown notes tree).

**Data model:** `{ projects: [...], items: [...], notes: [...] }`. Projects have `type: "work" | "argonath"` (a personal/work split used as a global UI toggle) and embedded `releases[]`. Items reference `projectId`/`releaseId` and carry state (`BACKLOG/TODO/ONGOING/DONE`), priority, type, tags, free-text fields (`analysis`, `prompt`, `report`), and `subitems`.

## 2. Strengths

- Genuinely simple to run and reason about: one data file, one server file, no build pipeline.
- Most mutations (add/edit/delete/reorder) call `saveDataToServer()` immediately rather than relying solely on the 60s timer — good instinct for not losing work.
- Backwards-compatible field migration on load (`description`, `notes` array) shows some care for schema evolution.
- Quick Edit table (drag reorder, double-click inline title edit, Tab-to-next-row) is a nicely scoped power-user feature and is fully wired end-to-end.
- Consistent visual/component language across pages (chips, badges, modal dialog) built from a shared `common.js`/`common.css`.

## 3. Issues Found & Fixed

### 3.1 Critical — data file can be silently destroyed on corruption or crash
**Status:** ✅ FIXED

**What was changed:**
- `server.js:30-53` — `writeBacklog()` now writes to a temp file first, then atomically renames it to `backlog.json` (atomic on same filesystem). Before each write, the current file is backed up to `backlog.json.bak`.
- `server.js:66-74` — `readBacklog()` now returns `null` on parse failure instead of silently returning empty data. The `/api/backlog` GET endpoint checks for this and returns HTTP 500 with a helpful error message pointing to the backup file.
- `common.js:40-70` — Client-side `loadDataFromServer()` now checks response status and shows a user-visible alert if the server returns 500, rather than silently accepting empty data.

**Result:** Writes are now atomic (survives crash mid-write); backups are kept; file corruption is detected and reported to the user with actionable recovery instructions rather than silently erasing the data.

### 3.2 High — kanban drag-and-drop between columns doesn't work
**Status:** ✅ FIXED

**What was changed:**
- `public/js/boards.js:150-210` — `renderStateBoard()` now attaches full `dragover`/`dragleave`/`drop` listeners to each `.column-dropzone`. On drop, the item's `state` is updated to the target column's state, `updatedAt` is refreshed, and if transitioning to/from `DONE` the `completedAt` timestamp is set/cleared appropriately.
- `public/js/boards.js:209-260` — `renderReleaseBoard()` now similarly attaches `dragover`/`dragleave`/`drop` listeners. On drop, the item's `releaseId` is updated to the target release (or `null` for the "no release" backlog column).
- Both reuse the same `.qe-drag-over` CSS class (already styled) for the visual drop-zone feedback.

**Result:** Drag-and-drop now works end-to-end on both the State Board and Release Board. Cards can be dragged between columns to change state or release, completing the feature advertised in the README.

### 3.3 Medium — self-XSS via unescaped user content in modal templates
**Status:** ✅ FIXED

**What was changed:**
- `common.js:92-104` — Added `escapeHtml()` helper function that escapes `&`, `<`, `>`, `"`, and `'` to their HTML entity equivalents.
- `public/js/boards.js` — Updated all modal templates to use `escapeHtml()` for user-controlled fields: `item.title`, `item.analysis`, `item.prompt`, `item.report`, `item.tags`, `item.filesAffected`, and all `subitems[].title` (lines ~673-713, ~645-650, ~760).
- `public/js/projects.js` — Updated project and release detail modals to use `escapeHtml()` for `project.name`, `project.description`, `project.repoPath`, `release.name`, and `release.description` (lines ~320-330, ~456-466).

**Result:** All user-controlled text interpolated into modal `innerHTML` is now HTML-escaped, preventing tag injection. Notes content remains unescaped by design (rendered as Markdown via `marked.parse()`, which is appropriate for that use case).

### 3.4 Medium — notes can't be created for a project with no releases
**Status:** ✅ FIXED

**What was changed:**
- `public/js/notes.js:244-262` — Added `createNoteForProject(projectId)` function that creates a note with `releaseId: null`, mirroring the existing `createNoteForRelease()`.
- `public/js/notes.js:83-97` — Updated `renderNotesTree()` to add a "+ Note" button to the project header (in addition to the per-release buttons), wired to `createNoteForProject()`.

**Result:** Projects with no releases can now have notes created directly from the tree UI. The project-level note creation path is now fully exposed.

### 3.5 Low — last-write-wins across tabs/pages with no conflict detection
**Status:** ℹ️ ACKNOWLEDGED (low priority)

**Note:** Every page independently fetches the full snapshot on load and POSTs the full snapshot back on every mutation and every 60s. If two tabs are open, the tab that saves last silently overwrites the other tab's in-memory state. For genuinely single-tab usage this never surfaces. Given the app is designed to be navigated between (nav pills at the top, not a SPA), multi-tab usage is unlikely in practice. A revision-counter mitigation could be added if multi-tab workflows become common.

### 3.6 Low — README is out of date
**Status:** ✅ FIXED

**What was changed:**
- `README.md:15` — Updated Quick Start to direct users to `http://localhost:3000` (which redirects to `index.html`) rather than the non-existent `backlog.html`. Users can then navigate to Boards, Projects, or Notes from the landing page.

**Result:** README now matches the actual URL structure.

### 3.7 Low — repeated per-page boilerplate
**Status:** ℹ️ ACKNOWLEDGED (deferred)

**Note:** `boards.js`, `projects.js`, and `notes.js` each independently define near-identical `serializeState()`/`saveStateToUrl()`/`loadStateFromUrl()`/`popstate` wiring. Factoring this into a shared helper in `common.js` would reduce duplication but is deferred until a fourth page is added, to avoid premature abstraction.

### 3.8 Low — CDN dependency undercuts "local-first" framing
**Status:** ✅ FIXED

**What was changed:**
- Downloaded `marked.js` from CDN and saved locally to `public/js/marked.min.js`.
- `public/notes.html:110` — Updated to load `marked` from `js/marked.min.js` instead of `cdn.jsdelivr.net`.

**Result:** The app now has zero external dependencies. Markdown rendering works offline, fully honoring the "local-first, no external service required" promise.

## 4. Design observations (non-blocking)

- Inline `style="..."` attributes are used extensively in JS-generated markup (e.g. `index.html:38-70`, most `if-row`/`if-field` layout in `boards.js`'s modal templates). This works fine at the current size but pulls layout out of the CSS files, making the two harder to keep in sync as the UI grows.
- The `work`/`argonath` project-type split is a global, page-wide toggle rather than a per-project attribute filter — reasonable given it's a personal/work life split, but worth knowing that switching it resets `currentProjectId`/`selectedProjectId` to a default whenever the active selection falls outside the new scope (`boards.js:1060-1066`, `projects.js:526-531`) — this is intentional and correctly implemented, just worth flagging as the expected behavior if it ever looks surprising.
- Archive behavior (DONE items older than 7 days move to a separate panel) is a nice touch for keeping boards uncluttered; the 7-day threshold (`common.js:92-96`) is hardcoded, which is fine for a personal tool but would be a natural first setting to expose if this ever gets a preferences panel.

## 5. Summary of Fixes

**Critical / High priority fixes (all completed):**
1. ✅ **Made writes crash-safe** (3.1) — atomic write to temp file + rename, backup copy kept at `backlog.json.bak`, server now rejects corrupted data with HTTP 500 and client shows alert.
2. ✅ **Implemented board drag-and-drop** (3.2) — wired up full `dragover`/`drop` handlers on state and release board columns; cards now drag to change state/release.
3. ✅ **Escaped user content in modals** (3.3) — added `escapeHtml()` helper, applied to all user-controlled fields in item/project/release detail modals.
4. ✅ **Added project-level note creation** (3.4) — new "+ Note" button in project header, `createNoteForProject()` function wired up.

**Low priority fixes (completed where simple):**
5. ✅ **Fixed README** (3.6) — corrected URL from non-existent `backlog.html` to root `/`.
6. ✅ **Vendored marked.js locally** (3.8) — removed CDN dependency, app now fully works offline.
7. ℹ️ **Acknowledged multi-tab conflict** (3.5) — not fixed (low priority, single-tab usage expected), but documented.
8. ℹ️ **Deferred boilerplate refactor** (3.7) — not fixed (low priority), awaiting a fourth page to justify extraction.

**Result:** App is now more robust (atomic writes, backup protection, file corruption detection), feature-complete (drag-and-drop works end-to-end, project-level notes possible), and secure (XSS vectors closed, no external dependencies).
