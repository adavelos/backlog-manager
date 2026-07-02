# Data Model — Backlog Manager

All state is stored in a single JSON file: `data/backlog.json`

```
{
  projects: Project[],
  items: Item[],
  notes: Note[]
}
```

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│ PROJECT                                                             │
│                                                                     │
│  id: string (generated)                                            │
│  name: string                                                      │
│  type: "work" | "argonath"                                        │
│  description: string (optional)                                   │
│  repoPath: string (optional)                                      │
│  releases: Release[]  ◄─┐                                         │
└─────────────────────────────────────────────────────────────────────┘
              │
              │ owns
              │
    ┌─────────┴────────────────┬──────────────────┐
    │                          │                  │
    ▼                          ▼                  ▼
┌──────────┐           ┌────────────┐      ┌──────────┐
│ RELEASE  │           │   ITEM     │      │  NOTE    │
│          │           │            │      │          │
│ id       │           │ id         │      │ id       │
│ name     │           │ projectId ─┼─────►│ title    │
│ state    │           │ releaseId ─┼─┐    │ content  │
│ desc...  │           │ title      │ │    │(Markdown)│
│ startDate│           │ priority   │ │    │createdAt │
│ endDate  │           │ type       │ │    │updatedAt │
│ note     │           │ state      │ │    │          │
└──────────┘           │ tags[]     │ │    └──────────┘
                       │ analysis   │ │
                       │ prompt     │ │
                       │ report     │ │
                       │ files[]    │ │
                       │ subitems[] │ │
                       │ createdAt  │ │
                       │ updatedAt  │ │
                       │ completedAt│ │
                       └────────────┘ │
                              ▲       │
                              │       │
                              └───────┴─ optional release ref
```

## Project

Represents a project (work or personal).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string | generated (`proj-<timestamp><random>`) | unique within projects[] |
| `name` | string | required, non-empty | user-visible title |
| `type` | enum | `"work"` \| `"argonath"` | determines which tab this appears in; UI-level filter, not permission |
| `description` | string | optional | free-text; optional to preserve backwards compat on load |
| `repoPath` | string | optional | intended for linking to a repo (not yet wired in the UI) |
| `releases` | Release[] | optional | array of releases within this project; empty is valid |

## Release

Groups items under a release milestone.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string | generated (`rel-<timestamp><random>`) | unique within project.releases[] |
| `name` | string | required | e.g. "R1 — MVP", "2.0 Launch" |
| `state` | enum | `"PLANNED"` \| `"ACTIVE"` \| `"ARCHIVED"` | `ARCHIVED` releases hidden from main board view |
| `description` | string | optional | free-text summary |
| `startDate` | timestamp \| null | optional | milliseconds since epoch; currently unused in UI |
| `endDate` | timestamp \| null | optional | milliseconds since epoch; currently unused in UI |
| `note` | string | optional | free-text (currently unused in UI) |

## Item

A work item (feature, bug, task) tracked in the backlog.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string | generated (`item-<timestamp><random>`) | unique within items[] |
| `projectId` | string | required, foreign key | must reference an existing project.id |
| `releaseId` | string \| null | optional, foreign key | if null, item is "unreleased" (BACKLOG); if set, must reference a project.releases[].id |
| `title` | string | required | user-visible name; editable inline in Quick Edit mode |
| `priority` | enum | `"LOW"` \| `"MEDIUM"` \| `"HIGH"` \| `"CRITICAL"` | defaults to `MEDIUM` on creation |
| `type` | enum | `"FEATURE"` \| `"BUG"` | defaults to `FEATURE` on creation |
| `state` | enum | `"BACKLOG"` \| `"TODO"` \| `"ONGOING"` \| `"DONE"` | position in the kanban board |
| `tags` | string[] | optional | free-form, user-created; filterable on board; comma-separated in UI |
| `analysis` | string | optional | free-text field for analysis/notes; visible in detail modal |
| `prompt` | string | optional | free-text field for AI prompts/instructions; visible in detail modal |
| `report` | string | optional | free-text field for results/reports; visible in detail modal |
| `filesAffected` | string[] | optional | comma-separated file paths; visible in detail modal |
| `subitems` | Subitem[] | optional | checklist within the item; visible in detail modal |
| `createdAt` | timestamp | required | milliseconds since epoch; set on creation, not updated |
| `updatedAt` | timestamp | required | milliseconds since epoch; set on creation, updated on any edit |
| `completedAt` | timestamp \| null | optional | milliseconds since epoch; set when state transitions to `DONE`, cleared if reverted from `DONE` |

### Archive Behavior

Items with `state === "DONE"` and `completedAt` more than 7 days old are considered "archived" and hidden from the main board view (visible only via the Archive panel toggle). See `common.js:isArchivedDone()`.

## Subitem

A checkbox item nested within an Item. Purely UI-level (not rendered on board, only in item detail modal).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string | generated (`si-<timestamp><random>`) | unique within item.subitems[] |
| `title` | string | required | subitem label |
| `done` | boolean | required | checked/unchecked state |

## Note

A Markdown note associated with a project and optionally a release.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string | generated (`note-<timestamp><random>`) | unique within notes[] |
| `projectId` | string | required, foreign key | must reference an existing project.id |
| `releaseId` | string \| null | optional, foreign key | if null, note is project-level; if set, must reference a project.releases[].id |
| `title` | string | required | note name; defaults to "Untitled note" |
| `content` | string | optional | Markdown source; rendered via `marked.parse()` (see notes.js:266) |
| `createdAt` | timestamp | required | milliseconds since epoch |
| `updatedAt` | timestamp | required | milliseconds since epoch; updated whenever title or content changes |

## Global State

The browser maintains additional in-memory state across pages via `common.js`:

| Variable | Type | Notes |
|----------|------|-------|
| `data` | `{ projects: [], items: [], notes: [] }` | fetched from `/api/backlog` on page load; POSTed back on mutation and every 60s |
| `config` | `{ dataDir: string, dataFile: string }` | fetched from `/api/config` on startup; display-only |
| `lastSyncAt` | Date \| null | updated after each successful POST; shown in status bar |
| `activeProjectType` | `"work"` \| `"argonath"` | global filter; synchronized via header toggle across all pages |
| `currentProjectId` | string \| `"ALL"` | boards-only; selected project filter |
| `activeTags` | Set<string> | boards-only; multi-select tag filter |

Page-specific state (like `view`, `quickEditMode`, `selectedNoteId`) is stored in URL query parameters and restored on page load / browser back-button.

## Constraints & Invariants

- **No orphans:** every item/note must reference an existing projectId. Deleting a project cascades deletion to its items and notes.
- **No loose releases:** deleting a release sets items' releaseId to null but doesn't delete the items themselves.
- **No unique constraints (except by ID):** project names and release names are not unique; duplicate names are allowed.
- **State machine:** item.state has four fixed values; no custom states.
- **Type split:** projects.type is the only schema divergence; there is no type-specific data (a "work" project has the same shape as an "argonath" project).
- **Archive is implicit:** archived items are computed by `isArchivedDone()` rather than stored; they are not marked with a flag in the item.

## Backwards Compatibility

When loading from the server, the client applies migrations to fill missing fields:

```js
// common.js:45-57
if (project.description === undefined) project.description = "";
if (release.description === undefined) release.description = "";
if (!data.notes) data.notes = [];
```

This allows older snapshots (from before these fields existed) to load gracefully.

## Data Persistence & Safety

- **Atomic writes:** The server writes to a temporary file first, then atomically renames it to `backlog.json`. This ensures the file is never left in a partially-written state if the process crashes.
- **Automatic backups:** Before each write, the current `backlog.json` is backed up to `backlog.json.bak`. If corruption is detected, the user is directed to this backup.
- **Corruption detection:** If the server encounters a read or parse error, it returns HTTP 500 with a user-visible alert rather than silently substituting empty data. This prevents accidental data loss from silent failures.
- **Client-side persistence:** The browser fetches the full snapshot on each page load and POSTs it back after every mutation (immediately) and periodically (every 60 seconds). Auto-save happens without user interaction.

## Security

- **HTML escaping:** All user-controlled text interpolated into modal templates is HTML-escaped via `escapeHtml()` (common.js) to prevent tag injection.
- **Markdown rendering:** Note content is rendered via `marked.parse()` (notes.js), which allows intentional HTML/Markdown in that context.
- **No external dependencies:** `marked.js` is vendored locally; the app requires no CDN or external service and works fully offline.
