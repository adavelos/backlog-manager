#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = process.env.BACKLOG_DATA_DIR
  || path.join(require('os').homedir(), '.backlog', 'data');
const JSON_FILE = path.join(DATA_DIR, 'backlog.json');
const DB_PATH = path.join(DATA_DIR, 'backlog.db');

console.log('📁 Data directory:', DATA_DIR);
console.log('📄 Reading JSON from:', JSON_FILE);
console.log('🗄️  Writing SQLite to:', DB_PATH);
console.log('');

// Read JSON
let jsonData = { projects: [], items: [], notes: [] };
if (fs.existsSync(JSON_FILE)) {
  try {
    const raw = fs.readFileSync(JSON_FILE, 'utf-8');
    jsonData = JSON.parse(raw);
    console.log(`✅ Loaded JSON: ${jsonData.projects.length} projects, ${jsonData.items.length} items, ${(jsonData.notes || []).length} notes`);
  } catch (err) {
    console.error('❌ Failed to read JSON:', err.message);
    process.exit(1);
  }
} else {
  console.log('⚠️  JSON file not found, creating empty database');
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function migrate() {
  const db = new sqlite3.Database(DB_PATH);

  await new Promise((resolve, reject) => {
    const schema = fs.readFileSync(path.join(__dirname, '../db/init.sql'), 'utf-8');
    db.exec(schema, (err) => err ? reject(err) : resolve());
  });
  console.log('✅ Schema created');
  console.log('');
  console.log('Migrating data...');

  await run(db, 'PRAGMA foreign_keys = OFF');
  await run(db, 'BEGIN TRANSACTION');

  try {
    await run(db, 'DELETE FROM notes');
    await run(db, 'DELETE FROM items');
    await run(db, 'DELETE FROM releases');
    await run(db, 'DELETE FROM projects');

    for (const p of jsonData.projects) {
      await run(db,
        `INSERT INTO projects (id, name, type, description, repoPath) VALUES (?, ?, ?, ?, ?)`,
        [p.id, p.name, p.type, p.description || '', p.repoPath || '']
      );
      for (const r of (p.releases || [])) {
        await run(db,
          `INSERT INTO releases (id, projectId, name, state, description, startDate, endDate, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, p.id, r.name, r.state || 'PLANNED', r.description || '', r.startDate || null, r.endDate || null, r.note || '']
        );
      }
    }

    let sortOrder = 0;
    for (const i of jsonData.items) {
      await run(db,
        `INSERT INTO items (
           id, projectId, title, state, priority, type, analysis, prompt, report,
           filesAffected, tags, subitems, sortOrder, completedAt, releaseId
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          i.id,
          i.projectId,
          i.title || '',
          i.state || 'BACKLOG',
          i.priority || null,
          i.type || null,
          i.analysis || null,
          i.prompt || null,
          i.report || null,
          i.filesAffected ? JSON.stringify(i.filesAffected) : null,
          i.tags ? JSON.stringify(i.tags) : null,
          i.subitems ? JSON.stringify(i.subitems) : null,
          sortOrder++,
          i.completedAt || null,
          i.releaseId || null
        ]
      );
    }

    for (const n of (jsonData.notes || [])) {
      await run(db,
        `INSERT INTO notes (id, projectId, releaseId, title, content) VALUES (?, ?, ?, ?, ?)`,
        [n.id, n.projectId || null, n.releaseId || null, n.title || '', n.content || '']
      );
    }

    await run(db, 'COMMIT');
    await run(db, 'PRAGMA foreign_keys = ON');

    console.log('✅ Migration complete!');
    console.log(`   - ${jsonData.projects.length} projects`);
    console.log(`   - ${jsonData.items.length} items`);
    console.log(`   - ${(jsonData.notes || []).length} notes`);
    console.log('');
    console.log('✨ SQLite database ready at:', DB_PATH);
    db.close();
  } catch (err) {
    console.error('❌ Error during migration:', err.message);
    await run(db, 'ROLLBACK').catch(() => {});
    db.close();
    process.exit(1);
  }
}

migrate();
