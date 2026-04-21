const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createDb(dataDir) {
  ensureDir(dataDir);
  const dbPath = path.join(dataDir, 'app.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      parent_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS dictation_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(section_id) REFERENCES sections(id)
    );

    CREATE TABLE IF NOT EXISTS audio_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      duration_ms INTEGER,
      seq INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES dictation_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS transcript_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audio_chunk_id INTEGER NOT NULL,
      raw_text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      confidence REAL,
      seq INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(audio_chunk_id) REFERENCES audio_chunks(id)
    );

    CREATE TABLE IF NOT EXISTS exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS glossary_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      project_id INTEGER,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(scope, project_id, source),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES (@key, @value, @updated_at)
  `);

  const now = nowIso();
  insertSetting.run({ key: 'sttEngine', value: 'mock', updated_at: now });
  insertSetting.run({ key: 'whisperCppPath', value: '', updated_at: now });
  insertSetting.run({ key: 'whisperModelPath', value: '', updated_at: now });

  return {
    dbPath,
    backupDatabase: (targetPath) => db.backup(targetPath),
    close: () => db.close(),
    listProjects: () => db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all(),
    createProject: (title) => {
      const ts = nowIso();
      const info = db
        .prepare('INSERT INTO projects(title, created_at, updated_at) VALUES (?, ?, ?)')
        .run(title, ts, ts);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);
    },
    getProject: (projectId) => db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId),
    touchProject: (projectId) => {
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), projectId);
    },
    listSections: (projectId) =>
      db
        .prepare('SELECT * FROM sections WHERE project_id = ? ORDER BY order_index ASC, id ASC')
        .all(projectId),
    createSection: ({ projectId, title, parentId = null }) => {
      const nextOrder =
        db
          .prepare('SELECT COALESCE(MAX(order_index), -1) AS max_order FROM sections WHERE project_id = ?')
          .get(projectId).max_order + 1;
      const ts = nowIso();
      const info = db
        .prepare(
          'INSERT INTO sections(project_id, parent_id, title, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(projectId, parentId, title, '', nextOrder, ts, ts);
      return db.prepare('SELECT * FROM sections WHERE id = ?').get(info.lastInsertRowid);
    },
    getSection: (sectionId) => db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId),
    updateSectionContent: ({ sectionId, content }) => {
      const ts = nowIso();
      db.prepare('UPDATE sections SET content = ?, updated_at = ? WHERE id = ?').run(content, ts, sectionId);
      return db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
    },
    appendSectionContent: ({ sectionId, appendedText }) => {
      const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
      if (!section) {
        throw new Error('Secțiunea nu există.');
      }
      const ts = nowIso();
      const next = section.content ? `${section.content}\n${appendedText}` : appendedText;
      db.prepare('UPDATE sections SET content = ?, updated_at = ? WHERE id = ?').run(next, ts, sectionId);
      return db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
    },
    startSession: ({ projectId, sectionId }) => {
      const ts = nowIso();
      const info = db
        .prepare(
          'INSERT INTO dictation_sessions(project_id, section_id, status, started_at, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(projectId, sectionId, 'active', ts, ts);
      return db.prepare('SELECT * FROM dictation_sessions WHERE id = ?').get(info.lastInsertRowid);
    },
    endSession: (sessionId) => {
      db.prepare('UPDATE dictation_sessions SET status = ?, ended_at = ? WHERE id = ?').run(
        'ended',
        nowIso(),
        sessionId
      );
      return db.prepare('SELECT * FROM dictation_sessions WHERE id = ?').get(sessionId);
    },
    getNextChunkSeq: (sessionId) => {
      return db
        .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM audio_chunks WHERE session_id = ?')
        .get(sessionId).next_seq;
    },
    createAudioChunk: ({ sessionId, filePath, durationMs, seq }) => {
      const info = db
        .prepare(
          'INSERT INTO audio_chunks(session_id, file_path, duration_ms, seq, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(sessionId, filePath, durationMs || null, seq, nowIso());
      return db.prepare('SELECT * FROM audio_chunks WHERE id = ?').get(info.lastInsertRowid);
    },
    createTranscriptChunk: ({ audioChunkId, rawText, normalizedText, confidence, seq }) => {
      const info = db
        .prepare(
          'INSERT INTO transcript_chunks(audio_chunk_id, raw_text, normalized_text, confidence, seq, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(audioChunkId, rawText, normalizedText, confidence || null, seq, nowIso());
      return db.prepare('SELECT * FROM transcript_chunks WHERE id = ?').get(info.lastInsertRowid);
    },
    listSessions: (projectId) =>
      db
        .prepare(
          `SELECT ds.*, s.title AS section_title
           FROM dictation_sessions ds
           JOIN sections s ON s.id = ds.section_id
           WHERE ds.project_id = ?
           ORDER BY ds.created_at DESC`
        )
        .all(projectId),
    listTranscriptForSection: (sectionId) =>
      db
        .prepare(
          `SELECT tc.*
           FROM transcript_chunks tc
           JOIN audio_chunks ac ON ac.id = tc.audio_chunk_id
           JOIN dictation_sessions ds ON ds.id = ac.session_id
           WHERE ds.section_id = ?
           ORDER BY tc.created_at ASC`
        )
        .all(sectionId),
    createExport: ({ projectId, filePath }) => {
      const info = db
        .prepare('INSERT INTO exports(project_id, file_path, created_at) VALUES (?, ?, ?)')
        .run(projectId, filePath, nowIso());
      return db.prepare('SELECT * FROM exports WHERE id = ?').get(info.lastInsertRowid);
    },
    getAllSettings: () => {
      const rows = db.prepare('SELECT key, value FROM settings').all();
      return rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
    },
    updateSettings: (nextSettings) => {
      const stmt = db.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
      const ts = nowIso();
      const tx = db.transaction((entries) => {
        entries.forEach(([key, value]) => stmt.run(key, String(value ?? ''), ts));
      });
      tx(Object.entries(nextSettings));
      return true;
    },
    listGlossaryTerms: ({ scope, projectId = null }) => {
      if (scope === 'global') {
        return db
          .prepare(
            'SELECT * FROM glossary_terms WHERE scope = ? AND project_id IS NULL ORDER BY source ASC'
          )
          .all(scope);
      }
      return db
        .prepare(
          'SELECT * FROM glossary_terms WHERE scope = ? AND project_id = ? ORDER BY source ASC'
        )
        .all(scope, projectId);
    },
    upsertGlossaryTerm: ({ scope, projectId = null, source, target }) => {
      const normalizedSource = String(source || '').trim().toLowerCase();
      const normalizedTarget = String(target || '').trim();
      if (!normalizedSource || !normalizedTarget) {
        throw new Error('Termen invalid în glosar.');
      }
      const ts = nowIso();
      if (scope === 'global') {
        const existing = db
          .prepare(
            'SELECT id FROM glossary_terms WHERE scope = ? AND project_id IS NULL AND source = ? LIMIT 1'
          )
          .get(scope, normalizedSource);
        if (existing) {
          db.prepare('UPDATE glossary_terms SET target = ?, updated_at = ? WHERE id = ?').run(
            normalizedTarget,
            ts,
            existing.id
          );
        } else {
          db.prepare(
            'INSERT INTO glossary_terms(scope, project_id, source, target, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?)'
          ).run(scope, normalizedSource, normalizedTarget, ts, ts);
        }
        return true;
      }

      const existing = db
        .prepare(
          'SELECT id FROM glossary_terms WHERE scope = ? AND project_id = ? AND source = ? LIMIT 1'
        )
        .get(scope, projectId, normalizedSource);
      if (existing) {
        db.prepare('UPDATE glossary_terms SET target = ?, updated_at = ? WHERE id = ?').run(
          normalizedTarget,
          ts,
          existing.id
        );
      } else {
        db.prepare(
          'INSERT INTO glossary_terms(scope, project_id, source, target, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(scope, projectId, normalizedSource, normalizedTarget, ts, ts);
      }
      return true;
    },
    deleteGlossaryTerm: (termId) => {
      db.prepare('DELETE FROM glossary_terms WHERE id = ?').run(termId);
      return true;
    }
  };
}

module.exports = {
  createDb,
  ensureDir
};
