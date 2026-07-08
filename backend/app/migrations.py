"""Plain SQL schema initialization (no Alembic)."""
import sqlite3
from pathlib import Path


def _column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(col[1] == column for col in cursor.fetchall())


def _has_check_constraint(cursor, table: str, marker: str) -> bool:
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,))
    row = cursor.fetchone()
    return bool(row and marker in row[0])


def init_db(db_path: Path) -> None:
    """Create the database schema if it doesn't exist."""
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path), timeout=5)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    cursor = conn.cursor()

    # Check if schema already exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects';")
    if not cursor.fetchone():
        # Create schema
        cursor.executescript("""
            CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT NOT NULL,
                repoPath TEXT NOT NULL,
                sortOrder REAL NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                CHECK (type IN ('work', 'argonath'))
            );

            CREATE TABLE scratchpads (
                type TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                CHECK (type IN ('work', 'argonath'))
            );

            CREATE TABLE releases (
                id TEXT PRIMARY KEY,
                projectId TEXT NOT NULL,
                name TEXT NOT NULL,
                state TEXT NOT NULL,
                isDefault INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL,
                startDate INTEGER,
                endDate INTEGER,
                note TEXT NOT NULL,
                sortOrder REAL NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                CHECK (state IN ('PLANNED', 'ACTIVE', 'RELEASED')),
                FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE items (
                id TEXT PRIMARY KEY,
                projectId TEXT NOT NULL,
                title TEXT NOT NULL,
                state TEXT NOT NULL,
                priority TEXT,
                type TEXT,
                analysis TEXT,
                prompt TEXT,
                report TEXT,
                filesAffected TEXT,
                tags TEXT,
                subitems TEXT,
                sortOrder REAL NOT NULL,
                completedAt INTEGER,
                releaseId TEXT,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                CHECK (state IN ('BACKLOG', 'TODO', 'ONGOING', 'DONE')),
                FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (releaseId) REFERENCES releases(id) ON DELETE SET NULL
            );

            CREATE TABLE notes (
                id TEXT PRIMARY KEY,
                projectId TEXT,
                releaseId TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (releaseId) REFERENCES releases(id) ON DELETE CASCADE
            );
        """)

    # ── Incremental migrations ──────────────────────────────────────────

    if not _column_exists(cursor, "projects", "ticketCounter"):
        cursor.execute(
            "ALTER TABLE projects ADD COLUMN ticketCounter INTEGER NOT NULL DEFAULT 0"
        )

    if not _column_exists(cursor, "items", "ticketNumber"):
        cursor.execute("ALTER TABLE items ADD COLUMN ticketNumber INTEGER")

    if not _column_exists(cursor, "projects", "key"):
        cursor.execute("ALTER TABLE projects ADD COLUMN key TEXT NOT NULL DEFAULT 'PR'")

    if not _column_exists(cursor, "items", "ticketId"):
        cursor.execute("ALTER TABLE items ADD COLUMN ticketId TEXT")

    if not _column_exists(cursor, "releases", "isDefault"):
        cursor.execute("ALTER TABLE releases ADD COLUMN isDefault INTEGER NOT NULL DEFAULT 0")

    # Constrain releases.state to the enum and fix the ARCHIVED->RELEASED bug
    # (SQLite has no ALTER TABLE ADD CONSTRAINT; add a CHECK-constrained shadow
    # column, backfill/normalize existing values, then swap it in).
    if not _has_check_constraint(cursor, "releases", "CHECK (state IN"):
        cursor.execute(
            "ALTER TABLE releases ADD COLUMN state_new TEXT NOT NULL DEFAULT 'PLANNED' "
            "CHECK (state_new IN ('PLANNED', 'ACTIVE', 'RELEASED'))"
        )
        cursor.execute("""
            UPDATE releases SET state_new = CASE
                WHEN state IN ('PLANNED', 'ACTIVE', 'RELEASED') THEN state
                WHEN state = 'ARCHIVED' THEN 'RELEASED'
                ELSE 'PLANNED'
            END
        """)
        cursor.execute("ALTER TABLE releases DROP COLUMN state")
        cursor.execute("ALTER TABLE releases RENAME COLUMN state_new TO state")

    conn.commit()
    conn.close()
