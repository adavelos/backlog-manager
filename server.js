const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurable data directory ---
const DATA_DIR = process.env.BACKLOG_DATA_DIR
  || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'backlog.json');

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

// --- File-based datastore helpers ---

function readBacklog() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading backlog data:', err.message);
  }
  return { projects: [], items: [] };
}

function writeBacklog(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing backlog data:', err.message);
    return false;
  }
}

// --- API endpoints ---

// GET /api/config — return storage configuration
app.get('/api/config', (req, res) => {
  res.json({
    dataDir: DATA_DIR,
    dataFile: DATA_FILE
  });
});

// GET /api/backlog — return the full JSON snapshot
app.get('/api/backlog', (req, res) => {
  const data = readBacklog();
  res.json(data);
});

// POST /api/backlog — accept a full JSON snapshot and persist it
app.post('/api/backlog', (req, res) => {
  const data = req.body;

  // Basic validation: must be an object with projects and items arrays
  if (!data || typeof data !== 'object' || !Array.isArray(data.projects) || !Array.isArray(data.items)) {
    return res.status(400).json({ status: 'error', message: 'Invalid payload: expected { projects: [], items: [] }' });
  }

  const ok = writeBacklog(data);
  if (ok) {
    res.json({ status: 'ok' });
  } else {
    res.status(500).json({ status: 'error', message: 'Failed to write data file' });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Backlog Manager running at http://localhost:${PORT}/index.html`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Data file: ${DATA_FILE}`);
});
