-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('work', 'argonath')),
  description TEXT DEFAULT '',
  repoPath TEXT DEFAULT '',
  sortOrder REAL NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Releases table (child of projects)
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PLANNED',
  description TEXT DEFAULT '',
  startDate INTEGER,
  endDate INTEGER,
  note TEXT DEFAULT '',
  sortOrder REAL NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- Items table (backlog entries)
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'BACKLOG'
    CHECK(state IN ('BACKLOG', 'TODO', 'ONGOING', 'DONE')),
  priority TEXT,
  type TEXT,
  analysis TEXT,
  prompt TEXT,
  report TEXT,
  filesAffected TEXT,
  tags TEXT,
  subitems TEXT,
  sortOrder REAL NOT NULL DEFAULT 0,
  completedAt INTEGER,
  releaseId TEXT,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(releaseId) REFERENCES releases(id) ON DELETE SET NULL
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  projectId TEXT,
  releaseId TEXT,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(releaseId) REFERENCES releases(id) ON DELETE CASCADE
);

-- Scratchpads table (one per project type: work, argonath)
CREATE TABLE IF NOT EXISTS scratchpads (
  type TEXT PRIMARY KEY CHECK(type IN ('work', 'argonath')),
  content TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Initialize scratchpads if they don't exist
INSERT OR IGNORE INTO scratchpads (type, content) VALUES ('work', '');
INSERT OR IGNORE INTO scratchpads (type, content) VALUES ('argonath', '');

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_project ON items(projectId);
CREATE INDEX IF NOT EXISTS idx_items_state ON items(state);
CREATE INDEX IF NOT EXISTS idx_items_release ON items(releaseId);
CREATE INDEX IF NOT EXISTS idx_items_sortorder ON items(sortOrder);
CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(projectId);
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(projectId);
CREATE INDEX IF NOT EXISTS idx_notes_release ON notes(releaseId);
