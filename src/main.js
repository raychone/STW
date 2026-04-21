const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, shell } = electron;
const path = require('path');
const fs = require('fs');
const { createDb, ensureDir } = require('./main/services/db');
const { transcribeAudio, testWhisperSetup, hasFfmpeg } = require('./main/services/transcriber');
const { normalizeRomanianText } = require('./main/lib/text-normalizer');
const { exportProjectToDocx } = require('./main/services/docx-export');

if (!app || !BrowserWindow || !ipcMain) {
  throw new Error(
    'Electron APIs indisponibile. Ruleaza cu `npm start` intr-un mediu desktop normal, fara `ELECTRON_RUN_AS_NODE`.'
  );
}

let runtime = null;
let store = null;

function initializeRuntimeAndStore() {
  if (runtime && store) {
    return;
  }

  const userDataDir = app.getPath('userData');
  runtime = {
    userDataDir,
    dataDir: path.join(userDataDir, 'data'),
    exportsDir: path.join(userDataDir, 'exports'),
    tempDir: path.join(userDataDir, 'tmp'),
    projectsDir: path.join(userDataDir, 'projects'),
    backupsDir: path.join(userDataDir, 'backups')
  };

  ensureDir(runtime.userDataDir);
  ensureDir(runtime.dataDir);
  ensureDir(runtime.exportsDir);
  ensureDir(runtime.tempDir);
  ensureDir(runtime.projectsDir);
  ensureDir(runtime.backupsDir);

  store = createDb(runtime.dataDir);
}

function requireStoreReady() {
  if (!store || !runtime) {
    throw new Error('Store-ul local nu este inițializat încă.');
  }
}

function getProjectAudioDir(projectId) {
  const dir = path.join(runtime.projectsDir, String(projectId), 'audio');
  ensureDir(dir);
  return dir;
}

function buildGlossaryMap(projectId) {
  const globalTerms = store.listGlossaryTerms({ scope: 'global' });
  const projectTerms = store.listGlossaryTerms({ scope: 'project', projectId });
  const map = new Map();

  globalTerms.forEach((term) => map.set(term.source, term.target));
  projectTerms.forEach((term) => map.set(term.source, term.target));

  return map;
}

function findFirstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function isSafeBackupPath(candidatePath) {
  const backupsRoot = path.resolve(runtime.backupsDir);
  const target = path.resolve(candidatePath);
  return target.startsWith(backupsRoot);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('bootstrap', async () => {
  requireStoreReady();
  return {
    projects: store.listProjects(),
    settings: store.getAllSettings(),
    dbPath: store.dbPath,
    userDataDir: runtime.userDataDir
  };
});

ipcMain.handle('project:create', async (_event, payload) => {
  requireStoreReady();
  const title = String(payload?.title || '').trim();
  if (!title) {
    throw new Error('Titlul proiectului este obligatoriu.');
  }
  const project = store.createProject(title);
  const section = store.createSection({ projectId: project.id, title: 'Capitol 1' });
  return { project, section };
});

ipcMain.handle('project:list', async () => {
  requireStoreReady();
  return store.listProjects();
});

ipcMain.handle('project:detail', async (_event, payload) => {
  requireStoreReady();
  const projectId = Number(payload?.projectId);
  const project = store.getProject(projectId);
  if (!project) {
    throw new Error('Proiectul nu există.');
  }
  return {
    project,
    sections: store.listSections(projectId),
    sessions: store.listSessions(projectId)
  };
});

ipcMain.handle('section:create', async (_event, payload) => {
  requireStoreReady();
  const projectId = Number(payload?.projectId);
  const title = String(payload?.title || '').trim();
  if (!projectId || !title) {
    throw new Error('ProjectId și title sunt obligatorii.');
  }
  const section = store.createSection({
    projectId,
    title,
    parentId: payload?.parentId ? Number(payload.parentId) : null
  });
  store.touchProject(projectId);
  return section;
});

ipcMain.handle('section:update-content', async (_event, payload) => {
  requireStoreReady();
  const sectionId = Number(payload?.sectionId);
  const content = String(payload?.content || '');
  if (!sectionId) {
    throw new Error('sectionId lipsă.');
  }
  const updated = store.updateSectionContent({ sectionId, content });
  store.touchProject(updated.project_id);
  return updated;
});

ipcMain.handle('dictation:start-session', async (_event, payload) => {
  requireStoreReady();
  const projectId = Number(payload?.projectId);
  const sectionId = Number(payload?.sectionId);
  if (!projectId || !sectionId) {
    throw new Error('projectId și sectionId sunt obligatorii.');
  }
  const session = store.startSession({ projectId, sectionId });
  return session;
});

ipcMain.handle('dictation:end-session', async (_event, payload) => {
  requireStoreReady();
  const sessionId = Number(payload?.sessionId);
  if (!sessionId) {
    throw new Error('sessionId lipsă.');
  }
  return store.endSession(sessionId);
});

ipcMain.handle('dictation:process-chunk', async (_event, payload) => {
  requireStoreReady();
  const sessionId = Number(payload?.sessionId);
  const sectionId = Number(payload?.sectionId);
  const projectId = Number(payload?.projectId);
  const bytes = payload?.bytes;
  const extension = String(payload?.extension || 'webm');
  const durationMs = Number(payload?.durationMs || 0);

  if (!sessionId || !sectionId || !projectId || !Array.isArray(bytes) || bytes.length === 0) {
    throw new Error('Date incomplete pentru chunk audio.');
  }

  const seq = store.getNextChunkSeq(sessionId);
  const audioDir = getProjectAudioDir(projectId);
  const fileName = `session-${sessionId}-chunk-${String(seq).padStart(4, '0')}.${extension}`;
  const filePath = path.join(audioDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(bytes));

  const audioChunk = store.createAudioChunk({
    sessionId,
    filePath,
    durationMs,
    seq
  });

  const settings = store.getAllSettings();

  let rawText = '';
  let normalizedText = '';
  let engineUsed = settings.sttEngine || 'mock';
  let transcriptionError = null;

  try {
    const transcription = transcribeAudio({
      audioPath: filePath,
      settings,
      tempDir: runtime.tempDir
    });
    rawText = transcription.rawText || '';
    engineUsed = transcription.engineUsed;
    normalizedText = normalizeRomanianText(rawText, {
      glossaryMap: buildGlossaryMap(projectId)
    });
  } catch (error) {
    transcriptionError = error.message || 'Eroare la transcriere locală';
  }

  if (normalizedText) {
    store.createTranscriptChunk({
      audioChunkId: audioChunk.id,
      rawText,
      normalizedText,
      confidence: null,
      seq
    });
    const updatedSection = store.appendSectionContent({ sectionId, appendedText: normalizedText });
    store.touchProject(projectId);

    return {
      ok: true,
      audioPath: filePath,
      rawText,
      normalizedText,
      engineUsed,
      updatedSection,
      transcriptionError
    };
  }

  return {
    ok: false,
    audioPath: filePath,
    rawText,
    normalizedText,
    engineUsed,
    transcriptionError
  };
});

ipcMain.handle('settings:get', async () => {
  requireStoreReady();
  return store.getAllSettings();
});

ipcMain.handle('settings:update', async (_event, payload) => {
  requireStoreReady();
  const allowed = {
    sttEngine: payload?.sttEngine || 'mock',
    whisperCppPath: payload?.whisperCppPath || '',
    whisperModelPath: payload?.whisperModelPath || ''
  };
  store.updateSettings(allowed);
  return store.getAllSettings();
});

ipcMain.handle('settings:test-whisper', async (_event, payload) => {
  requireStoreReady();
  const saved = store.getAllSettings();
  const settings = {
    ...saved,
    ...(payload || {})
  };
  return testWhisperSetup({ settings });
});

ipcMain.handle('settings:pick-whisper-exec', async () => {
  requireStoreReady();
  const result = await dialog.showOpenDialog({
    title: 'Alege executabil whisper.cpp',
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths?.length) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('settings:pick-whisper-model', async () => {
  requireStoreReady();
  const result = await dialog.showOpenDialog({
    title: 'Alege model whisper (.bin)',
    properties: ['openFile'],
    filters: [{ name: 'Whisper model', extensions: ['bin'] }, { name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePaths?.length) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('settings:auto-configure-whisper', async () => {
  requireStoreReady();
  const homeDir = app.getPath('home');
  const isWin = process.platform === 'win32';
  const execCandidates = isWin
    ? [
        path.join(homeDir, 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-cli.exe'),
        path.join(homeDir, 'whisper.cpp', 'build', 'bin', 'whisper-cli.exe')
      ]
    : ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli', path.join(homeDir, 'whisper.cpp', 'build', 'bin', 'whisper-cli')];

  const modelCandidates = [
    path.join(homeDir, 'whisper.cpp', 'models', 'ggml-base.bin'),
    path.join(homeDir, 'whisper.cpp', 'models', 'ggml-small.bin'),
    path.join(homeDir, 'whisper.cpp', 'models', 'ggml-medium.bin')
  ];

  const execPath = findFirstExistingPath(execCandidates);
  const modelPath = findFirstExistingPath(modelCandidates);

  if (!execPath && !modelPath) {
    return {
      ok: false,
      message: 'Nu am găsit automat nici executabilul, nici modelul. Folosește butoanele Alege.'
    };
  }

  const next = store.getAllSettings();
  if (execPath) next.whisperCppPath = execPath;
  if (modelPath) next.whisperModelPath = modelPath;
  next.sttEngine = 'whispercpp';
  store.updateSettings(next);

  return {
    ok: true,
    message: 'Auto-configurare aplicată.',
    settings: store.getAllSettings()
  };
});

ipcMain.handle('settings:diagnostics', async () => {
  requireStoreReady();
  const settings = store.getAllSettings();
  const result = {
    sttEngine: settings.sttEngine || 'mock',
    whisperExecConfigured: Boolean(settings.whisperCppPath),
    whisperModelConfigured: Boolean(settings.whisperModelPath),
    whisperExecExists: settings.whisperCppPath ? fs.existsSync(settings.whisperCppPath) : false,
    whisperModelExists: settings.whisperModelPath ? fs.existsSync(settings.whisperModelPath) : false,
    ffmpegInstalled: hasFfmpeg(),
    userDataDir: runtime.userDataDir,
    projectsCount: store.listProjects().length
  };
  result.readyForRealDictation =
    result.sttEngine === 'whispercpp' &&
    result.whisperExecConfigured &&
    result.whisperModelConfigured &&
    result.whisperExecExists &&
    result.whisperModelExists;
  return result;
});

ipcMain.handle('project:export-docx', async (_event, payload) => {
  requireStoreReady();
  const projectId = Number(payload?.projectId);
  if (!projectId) {
    throw new Error('projectId este obligatoriu pentru export.');
  }

  const project = store.getProject(projectId);
  if (!project) {
    throw new Error('Proiect inexistent.');
  }

  const sections = store.listSections(projectId);
  const filePath = await exportProjectToDocx({
    project,
    sections,
    exportsDir: runtime.exportsDir
  });

  store.createExport({ projectId, filePath });
  return { filePath };
});

ipcMain.handle('project:show-export-in-folder', async (_event, payload) => {
  requireStoreReady();
  const filePath = String(payload?.filePath || '');
  if (!filePath) {
    throw new Error('filePath obligatoriu.');
  }
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('glossary:list', async (_event, payload) => {
  requireStoreReady();
  const projectId = Number(payload?.projectId);
  if (!projectId) {
    throw new Error('projectId obligatoriu.');
  }
  return {
    globalTerms: store.listGlossaryTerms({ scope: 'global' }),
    projectTerms: store.listGlossaryTerms({ scope: 'project', projectId })
  };
});

ipcMain.handle('glossary:upsert', async (_event, payload) => {
  requireStoreReady();
  const scope = String(payload?.scope || 'project');
  const source = String(payload?.source || '').trim();
  const target = String(payload?.target || '').trim();
  const projectId = Number(payload?.projectId || 0);

  if (scope !== 'global' && !projectId) {
    throw new Error('projectId obligatoriu pentru glosar de proiect.');
  }
  store.upsertGlossaryTerm({
    scope,
    projectId: scope === 'global' ? null : projectId,
    source,
    target
  });
  return true;
});

ipcMain.handle('glossary:delete', async (_event, payload) => {
  requireStoreReady();
  const termId = Number(payload?.termId || 0);
  if (!termId) {
    throw new Error('termId obligatoriu.');
  }
  store.deleteGlossaryTerm(termId);
  return true;
});

ipcMain.handle('backup:create', async () => {
  requireStoreReady();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(runtime.backupsDir, `backup-${stamp}`);
  ensureDir(backupDir);

  const dbTarget = path.join(backupDir, 'app.db');
  await store.backupDatabase(dbTarget);

  const projectsTarget = path.join(backupDir, 'projects');
  fs.cpSync(runtime.projectsDir, projectsTarget, { recursive: true });

  return { backupDir };
});

ipcMain.handle('backup:list', async () => {
  requireStoreReady();
  const entries = fs.existsSync(runtime.backupsDir)
    ? fs
        .readdirSync(runtime.backupsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse()
    : [];
  return entries.map((name) => path.join(runtime.backupsDir, name));
});

ipcMain.handle('backup:restore', async (_event, payload) => {
  requireStoreReady();
  const backupDir = String(payload?.backupDir || '');
  if (!backupDir) {
    throw new Error('backupDir obligatoriu.');
  }
  if (!isSafeBackupPath(backupDir)) {
    throw new Error('backupDir invalid.');
  }
  if (!fs.existsSync(backupDir)) {
    throw new Error('Backup inexistent.');
  }

  const backupDb = path.join(backupDir, 'app.db');
  const backupProjects = path.join(backupDir, 'projects');
  if (!fs.existsSync(backupDb) || !fs.existsSync(backupProjects)) {
    throw new Error('Backup corupt: lipsesc app.db sau projects/.');
  }

  const safetyStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyDir = path.join(runtime.backupsDir, `pre-restore-${safetyStamp}`);
  ensureDir(safetyDir);
  await store.backupDatabase(path.join(safetyDir, 'app.db'));
  fs.cpSync(runtime.projectsDir, path.join(safetyDir, 'projects'), { recursive: true });

  store.close();
  store = null;

  ensureDir(runtime.dataDir);
  const dbPath = path.join(runtime.dataDir, 'app.db');
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
  if (fs.existsSync(`${dbPath}-wal`)) fs.rmSync(`${dbPath}-wal`, { force: true });
  if (fs.existsSync(`${dbPath}-shm`)) fs.rmSync(`${dbPath}-shm`, { force: true });
  if (fs.existsSync(runtime.projectsDir)) {
    fs.rmSync(runtime.projectsDir, { recursive: true, force: true });
  }
  ensureDir(runtime.projectsDir);

  fs.copyFileSync(backupDb, dbPath);
  fs.cpSync(backupProjects, runtime.projectsDir, { recursive: true });
  store = createDb(runtime.dataDir);

  app.relaunch();
  setImmediate(() => app.exit(0));
  return { ok: true };
});

app.whenReady().then(() => {
  initializeRuntimeAndStore();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (store) {
    store.close();
  }
});
