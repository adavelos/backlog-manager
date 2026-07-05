"""Plain SQL schema initialization (no Alembic)."""
import sqlite3
from pathlib import Path


def init_db(db_path: Path) -> None:
    """Create the database schema if it doesn't exist."""
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path), timeout=5)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    cursor = conn.cursor()

    # Check if schema already exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects';")
    if cursor.fetchone():
        conn.close()
        return  # Schema already initialized

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
            description TEXT NOT NULL,
            startDate INTEGER,
            endDate INTEGER,
            note TEXT NOT NULL,
            sortOrder REAL NOT NULL,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
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

    conn.commit()
    conn.close()
