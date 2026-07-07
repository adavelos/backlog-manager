"""Plain SQL schema initialization (no Alembic)."""
import sqlite3
from pathlib import Path


def _column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(col[1] == column for col in cursor.fetchall())


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

    # ── Backfill project keys ───────────────────────────────────────────

    cursor.execute("SELECT id, name FROM projects")
    project_rows = cursor.fetchall()

    # Hardcoded overrides for existing projects that need specific keys
    KEY_OVERRIDES = {
        "Backlog Manager": "BMG",
        "CBAM-DLQ": "DLQ",
        "Foundation": "FND",
    }

    used_keys: set[str] = set()
    for pid, name in project_rows:
        if name in KEY_OVERRIDES:
            key = KEY_OVERRIDES[name]
        else:
            first_word = (name or "").strip().split()[0].upper() if (name or "").strip() else ""
            base_key = first_word[:3] if len(first_word) >= 3 else (first_word or "PRJ")
            if len(base_key) < 3:
                base_key = base_key.ljust(3, base_key[-1] if base_key else "P")

            # Resolve collisions
            key = base_key
            suffix = 1
            while key in used_keys:
                key = base_key[0] + str(suffix)
                suffix += 1
        used_keys.add(key)
        cursor.execute("UPDATE projects SET key = ? WHERE id = ?", (key, pid))

    # ── Backfill ticketCounter ─────────────────────────────────────────

    cursor.execute(
        "UPDATE projects SET ticketCounter = (SELECT COUNT(*) FROM items WHERE items.projectId = projects.id)"
    )

    # ── Backfill ticketNumber + ticketId ───────────────────────────────

    cursor.execute(
        "SELECT id, projectId, createdAt, rowid FROM items ORDER BY projectId, createdAt, rowid"
    )
    rows = cursor.fetchall()
    item_data: list[tuple[str, str, int]] = []
    seq_by_project: dict[str, int] = {}
    for item_id, project_id, _created, _rowid in rows:
        seq_by_project[project_id] = seq_by_project.get(project_id, 0) + 1
        ticket_number = seq_by_project[project_id]
        cursor.execute(
            "UPDATE items SET ticketNumber = ? WHERE id = ?",
            (ticket_number, item_id),
        )
        item_data.append((item_id, project_id, ticket_number))

    # Fetch project key lookup after backfill
    cursor.execute("SELECT id, key FROM projects")
    project_key_map = dict(cursor.fetchall())

    for item_id, project_id, ticket_number in item_data:
        key = project_key_map.get(project_id, "PR")
        cursor.execute(
            "UPDATE items SET ticketId = ? WHERE id = ?",
            (f"{key}-{ticket_number:04d}", item_id),
        )

    conn.commit()
    conn.close()
