const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurable data directory ---
// Defaults to a fixed location outside the repo so the data file is the same
// regardless of how/where the server is started (npm start, start.sh, IDE run
// button, etc). Override with BACKLOG_DATA_DIR if you need a different path.
const DATA_DIR = process.env.BACKLOG_DATA_DIR
  || path.join(require('os').homedir(), '.backlog', 'data');
const DB_PATH = path.join(DATA_DIR, 'backlog.db');

let db = null;

// --- Logging helper ---
const LOG_FILE = '/tmp/backlog-manager.log';

function writeLog(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  (level === 'ERROR' ? console.error : console.log)(line);
  fs.appendFile(LOG_FILE, line + '\n', (err) => {
    if (err) console.error(`Failed to write to log file: ${err.message}`);
  });
}

const log = {
  info: (msg) => writeLog('INFO', msg),
  warn: (msg) => writeLog('WARN', msg),
  error: (msg) => writeLog('ERROR', msg),
};

// --- Middleware ---
app.use(express.json());

// Redirect root to the app
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Suppress favicon errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Database initialization ---

function runSchema(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function migrateDB() {
  // Add sortOrder column to projects if missing (migration for existing DBs)
  try {
    await dbRun("ALTER TABLE projects ADD COLUMN sortOrder REAL NOT NULL DEFAULT 0");
    log.info('Migration: added sortOrder to projects');
  } catch (e) {
    if (!e.message.includes('duplicate column')) {
      log.warn('Migration (projects.sortOrder): ' + e.message);
    }
  }
  try {
    await dbRun("ALTER TABLE releases ADD COLUMN sortOrder REAL NOT NULL DEFAULT 0");
    log.info('Migration: added sortOrder to releases');
  } catch (e) {
    if (!e.message.includes('duplicate column')) {
      log.warn('Migration (releases.sortOrder): ' + e.message);
    }
  }
}

function initDB() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        log.error('Failed to open database: ' + err.message);
        return reject(err);
      }

      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON', async (err) => {
        if (err) return reject(err);

        // Enable WAL mode for crash safety
        db.run('PRAGMA journal_mode = WAL', async (err) => {
          if (err) return reject(err);

          try {
            // Load and execute schema
            const schema = fs.readFileSync(path.join(__dirname, 'db/init.sql'), 'utf-8');
            await runSchema(schema);
            // Run migrations for existing databases
            await migrateDB();
            log.info('SQLite initialized at ' + DB_PATH);
            log.info('WAL mode enabled for crash safety');
            resolve();
          } catch (err) {
            log.error('Failed to initialize schema: ' + err.message);
            return reject(err);
          }
        });
      });
    });
  });
}

// --- SQLite promise helpers ---

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.lastID, this.changes
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function isConstraintError(err) {
  return err && err.code === 'SQLITE_CONSTRAINT';
}

function parseItemRow(row) {
  if (!row) return row;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    filesAffected: row.filesAffected ? JSON.parse(row.filesAffected) : [],
    subitems: row.subitems ? JSON.parse(row.subitems) : []
  };
}

// --- Aggregate read (initial page load only) ---

async function readBacklogFromDB() {
  const projects = await dbAll('SELECT * FROM projects ORDER BY sortOrder, name');
  const releases = await dbAll('SELECT * FROM releases ORDER BY sortOrder, name');
  projects.forEach(p => {
    p.releases = releases.filter(r => r.projectId === p.id);
  });
  const items = await dbAll('SELECT * FROM items ORDER BY sortOrder');
  const notes = await dbAll('SELECT * FROM notes ORDER BY projectId');
  const scratchpadRows = await dbAll('SELECT * FROM scratchpads ORDER BY type');
  const scratchpads = {};
  scratchpadRows.forEach(row => {
    scratchpads[row.type] = {
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  });
  return { projects, items: items.map(parseItemRow), notes, scratchpads };
}

// --- API endpoints ---

// GET /api/config — return storage configuration
app.get('/api/config', (req, res) => {
  let dataTimestamp = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      dataTimestamp = fs.statSync(DB_PATH).mtimeMs;
    }
  } catch (e) {
    // ignore stat failures
  }
  res.json({
    dataDir: DATA_DIR,
    dataFile: DB_PATH,
    dataTimestamp
  });
});

// GET /api/backlog — read-only aggregate snapshot, used only for initial page load
app.get('/api/backlog', async (req, res) => {
  try {
    const data = await readBacklogFromDB();
    res.json(data);
  } catch (err) {
    log.error('Error reading backlog: ' + err.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to read backlog data. Check server logs.'
    });
  }
});

// ============================================================
// Projects
// ============================================================

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbAll('SELECT * FROM projects ORDER BY sortOrder, name');
    const releases = await dbAll('SELECT * FROM releases ORDER BY sortOrder, name');
    projects.forEach(p => {
      p.releases = releases.filter(r => r.projectId === p.id);
    });
    res.json(projects);
  } catch (err) {
    log.error('Error listing projects: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to list projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  const p = req.body;
  if (!p || !p.id || !p.name || !p.type) {
    return res.status(400).json({ status: 'error', message: 'Project requires id, name, type' });
  }
  try {
    await dbRun(
      `INSERT INTO projects (id, name, type, description, repoPath, sortOrder) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.type, p.description || '', p.repoPath || '', p.sortOrder ?? 0]
    );
    const created = await dbGet('SELECT * FROM projects WHERE id = ?', [p.id]);
    created.releases = [];
    log.info('Project created: ' + p.id);
    res.status(201).json(created);
  } catch (err) {
    log.error('Error creating project: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to create project' });
  }
});

app.patch('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['name', 'type', 'description', 'repoPath', 'sortOrder'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (updates.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No fields to update' });
  }
  updates.push('updatedAt = unixepoch()');
  params.push(id);
  try {
    const result = await dbRun(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }
    const updated = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
    log.info('Project updated: ' + id);
    res.json(updated);
  } catch (err) {
    log.error('Error updating project: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }
    log.info('Project deleted (cascades to releases/items/notes): ' + req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    log.error('Error deleting project: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to delete project' });
  }
});

// ============================================================
// Releases
// ============================================================

app.post('/api/projects/:projectId/releases', async (req, res) => {
  const { projectId } = req.params;
  const r = req.body;
  if (!r || !r.id || !r.name) {
    return res.status(400).json({ status: 'error', message: 'Release requires id, name' });
  }
  try {
    await dbRun(
      `INSERT INTO releases (id, projectId, name, state, description, startDate, endDate, note, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, projectId, r.name, r.state || 'PLANNED', r.description || '', r.startDate || null, r.endDate || null, r.note || '', r.sortOrder ?? 0]
    );
    const created = await dbGet('SELECT * FROM releases WHERE id = ?', [r.id]);
    log.info('Release created: ' + r.id);
    res.status(201).json(created);
  } catch (err) {
    log.error('Error creating release: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to create release (check projectId exists)' });
  }
});

app.patch('/api/releases/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['name', 'state', 'description', 'startDate', 'endDate', 'note', 'sortOrder'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (updates.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No fields to update' });
  }
  updates.push('updatedAt = unixepoch()');
  params.push(id);
  try {
    const result = await dbRun(`UPDATE releases SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Release not found' });
    }
    const updated = await dbGet('SELECT * FROM releases WHERE id = ?', [id]);
    log.info('Release updated: ' + id);
    res.json(updated);
  } catch (err) {
    log.error('Error updating release: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to update release' });
  }
});

app.delete('/api/releases/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM releases WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Release not found' });
    }
    log.info('Release deleted (items unreleased, release notes removed): ' + req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    log.error('Error deleting release: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to delete release' });
  }
});

// ============================================================
// Items
// ============================================================

app.get('/api/items', async (req, res) => {
  try {
    const clauses = [];
    const params = [];
    if (req.query.projectId) { clauses.push('projectId = ?'); params.push(req.query.projectId); }
    if (req.query.state) { clauses.push('state = ?'); params.push(req.query.state); }
    if (req.query.releaseId) { clauses.push('releaseId = ?'); params.push(req.query.releaseId); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const items = await dbAll(`SELECT * FROM items ${where} ORDER BY sortOrder`, params);
    res.json(items.map(parseItemRow));
  } catch (err) {
    log.error('Error listing items: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to list items' });
  }
});

app.post('/api/items', async (req, res) => {
  const i = req.body;
  if (!i || !i.id || !i.projectId || !i.title) {
    return res.status(400).json({ status: 'error', message: 'Item requires id, projectId, title' });
  }
  try {
    const maxRow = await dbGet('SELECT MAX(sortOrder) as maxOrder FROM items');
    const sortOrder = i.sortOrder !== undefined
      ? i.sortOrder
      : ((maxRow && maxRow.maxOrder != null) ? maxRow.maxOrder + 1 : 0);
    const completedAt = i.state === 'DONE' ? (i.completedAt || Date.now()) : null;

    await dbRun(
      `INSERT INTO items (
         id, projectId, title, state, priority, type, analysis, prompt, report,
         filesAffected, tags, subitems, sortOrder, completedAt, releaseId
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        i.id, i.projectId, i.title, i.state || 'BACKLOG', i.priority || null, i.type || null,
        i.analysis || null, i.prompt || null, i.report || null,
        i.filesAffected ? JSON.stringify(i.filesAffected) : null,
        i.tags ? JSON.stringify(i.tags) : null,
        i.subitems ? JSON.stringify(i.subitems) : null,
        sortOrder,
        completedAt,
        i.releaseId || null
      ]
    );
    const created = await dbGet('SELECT * FROM items WHERE id = ?', [i.id]);
    log.info('Item created: ' + i.id);
    res.status(201).json(parseItemRow(created));
  } catch (err) {
    log.error('Error creating item: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to create item (check projectId/releaseId/state)' });
  }
});

app.patch('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  try {
    const existing = await dbGet('SELECT * FROM items WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    const fields = ['title', 'state', 'priority', 'type', 'analysis', 'prompt', 'report', 'releaseId', 'sortOrder'];
    const jsonFields = ['tags', 'filesAffected', 'subitems'];
    const updates = [];
    const params = [];

    fields.forEach(f => {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(body[f]);
      }
    });
    jsonFields.forEach(f => {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(JSON.stringify(body[f]));
      }
    });

    // Server owns the completedAt transition — client should never set this directly
    if (body.state !== undefined) {
      if (body.state === 'DONE' && existing.state !== 'DONE') {
        updates.push('completedAt = ?');
        params.push(Date.now());
      } else if (body.state !== 'DONE' && existing.state === 'DONE') {
        updates.push('completedAt = NULL');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No fields to update' });
    }

    updates.push('updatedAt = unixepoch()');
    params.push(id);

    await dbRun(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await dbGet('SELECT * FROM items WHERE id = ?', [id]);
    log.info('Item updated: ' + id);
    res.json(parseItemRow(updated));
  } catch (err) {
    log.error('Error updating item: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM items WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Item not found' });
    }
    log.info('Item deleted: ' + req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    log.error('Error deleting item: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to delete item' });
  }
});

// ============================================================
// Notes
// ============================================================

app.post('/api/notes', async (req, res) => {
  const n = req.body;
  if (!n || !n.id) {
    return res.status(400).json({ status: 'error', message: 'Note requires id' });
  }
  try {
    await dbRun(
      `INSERT INTO notes (id, projectId, releaseId, title, content) VALUES (?, ?, ?, ?, ?)`,
      [n.id, n.projectId || null, n.releaseId || null, n.title || '', n.content || '']
    );
    const created = await dbGet('SELECT * FROM notes WHERE id = ?', [n.id]);
    log.info('Note created: ' + n.id);
    res.status(201).json(created);
  } catch (err) {
    log.error('Error creating note: ' + err.message);
    res.status(isConstraintError(err) ? 400 : 500).json({ status: 'error', message: 'Failed to create note' });
  }
});

app.patch('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['title', 'content'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (updates.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No fields to update' });
  }
  updates.push('updatedAt = unixepoch()');
  params.push(id);
  try {
    const result = await dbRun(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Note not found' });
    }
    const updated = await dbGet('SELECT * FROM notes WHERE id = ?', [id]);
    log.info('Note updated: ' + id);
    res.json(updated);
  } catch (err) {
    log.error('Error updating note: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to update note' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM notes WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Note not found' });
    }
    log.info('Note deleted: ' + req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    log.error('Error deleting note: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to delete note' });
  }
});

// ============================================================
// Scratchpads
// ============================================================

app.patch('/api/scratchpads/:type', async (req, res) => {
  const { type } = req.params;
  if (!['work', 'argonath'].includes(type)) {
    return res.status(400).json({ status: 'error', message: 'Invalid scratchpad type' });
  }
  const fields = ['content'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (updates.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No fields to update' });
  }
  updates.push('updatedAt = unixepoch()');
  params.push(type);
  try {
    const result = await dbRun(`UPDATE scratchpads SET ${updates.join(', ')} WHERE type = ?`, params);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Scratchpad not found' });
    }
    const updated = await dbGet('SELECT * FROM scratchpads WHERE type = ?', [type]);
    log.info('Scratchpad updated: ' + type);
    res.json({
      content: updated.content,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    });
  } catch (err) {
    log.error('Error updating scratchpad: ' + err.message);
    res.status(500).json({ status: 'error', message: 'Failed to update scratchpad' });
  }
});

// --- Start server ---
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      log.info(`Backlog Manager running at http://localhost:${PORT}/index.html`);
      log.info(`Data directory: ${DATA_DIR}`);
      log.info(`Database file: ${DB_PATH}`);
    });
  } catch (err) {
    log.error('Failed to start server: ' + err.message);
    process.exit(1);
  }
}

startServer();

// --- Catch process-level crashes ---
process.on('uncaughtException', (err) => log.error('Uncaught exception: ' + err.stack));
process.on('unhandledRejection', (reason) => log.error('Unhandled rejection: ' + reason));
