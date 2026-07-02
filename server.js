const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurable data directory ---
// Defaults to a fixed location outside the repo so the data file is the same
// regardless of how/where the server is started (npm start, start.sh, IDE run
// button, etc). Override with BACKLOG_DATA_DIR if you need a different path.
const DATA_DIR = process.env.BACKLOG_DATA_DIR
  || path.join(require('os').homedir(), '.backlog', 'data');
const DATA_FILE = path.join(DATA_DIR, 'backlog.json');

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

// --- File-based datastore helpers ---

function readBacklog() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    log.error('Error reading backlog data: ' + err.stack);
    // Return null to signal read failure; caller will detect and reject with 5xx
    return null;
  }
  return { projects: [], items: [] };
}

function writeBacklog(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Write to a temporary file first, then atomically rename it.
    const tempFile = DATA_FILE + '.tmp';
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');

    // Before renaming, create a backup of the current file (if it exists).
    if (fs.existsSync(DATA_FILE)) {
      const backupFile = DATA_FILE + '.bak';
      fs.copyFileSync(DATA_FILE, backupFile);
    }

    // Atomically replace the old file with the new one.
    fs.renameSync(tempFile, DATA_FILE);
    log.info(`Backlog write succeeded (${jsonStr.length} bytes)`);
    return true;
  } catch (err) {
    log.error('Error writing backlog data: ' + err.stack);
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
  if (data === null) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to read or parse backlog data. Check server logs. A backup may exist at ' + DATA_FILE + '.bak'
    });
  }
  res.json(data);
});

// POST /api/backlog — accept a full JSON snapshot and persist it
app.post('/api/backlog', (req, res) => {
  const data = req.body;

  // Basic validation: must be an object with projects and items arrays
  if (!data || typeof data !== 'object' || !Array.isArray(data.projects) || !Array.isArray(data.items)) {
    log.warn('Rejected invalid backlog payload');
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
  log.info(`Backlog Manager running at http://localhost:${PORT}/index.html`);
  log.info(`Data directory: ${DATA_DIR}`);
  log.info(`Data file: ${DATA_FILE}`);
});

// --- Catch process-level crashes ---
process.on('uncaughtException', (err) => log.error('Uncaught exception: ' + err.stack));
process.on('unhandledRejection', (reason) => log.error('Unhandled rejection: ' + reason));
