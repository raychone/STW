const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('localApi', {
  bootstrap: () => ipcRenderer.invoke('bootstrap'),
  createProject: (title) => ipcRenderer.invoke('project:create', { title }),
  listProjects: () => ipcRenderer.invoke('project:list'),
  getProjectDetail: (projectId) => ipcRenderer.invoke('project:detail', { projectId }),
  createSection: (projectId, title, parentId = null) =>
    ipcRenderer.invoke('section:create', { projectId, title, parentId }),
  updateSectionContent: (sectionId, content) =>
    ipcRenderer.invoke('section:update-content', { sectionId, content }),
  startSession: (projectId, sectionId) =>
    ipcRenderer.invoke('dictation:start-session', { projectId, sectionId }),
  endSession: (sessionId) => ipcRenderer.invoke('dictation:end-session', { sessionId }),
  processChunk: ({ sessionId, sectionId, projectId, bytes, extension, durationMs }) =>
    ipcRenderer.invoke('dictation:process-chunk', {
      sessionId,
      sectionId,
      projectId,
      bytes,
      extension,
      durationMs
    }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  testWhisperSetup: (settings) => ipcRenderer.invoke('settings:test-whisper', settings || {}),
  pickWhisperExecutable: () => ipcRenderer.invoke('settings:pick-whisper-exec'),
  pickWhisperModel: () => ipcRenderer.invoke('settings:pick-whisper-model'),
  autoConfigureWhisper: () => ipcRenderer.invoke('settings:auto-configure-whisper'),
  getDiagnostics: () => ipcRenderer.invoke('settings:diagnostics'),
  exportDocx: (projectId) => ipcRenderer.invoke('project:export-docx', { projectId }),
  showExportInFolder: (filePath) => ipcRenderer.invoke('project:show-export-in-folder', { filePath }),
  listGlossary: (projectId) => ipcRenderer.invoke('glossary:list', { projectId }),
  upsertGlossaryTerm: ({ scope, projectId, source, target }) =>
    ipcRenderer.invoke('glossary:upsert', { scope, projectId, source, target }),
  deleteGlossaryTerm: (termId) => ipcRenderer.invoke('glossary:delete', { termId }),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (backupDir) => ipcRenderer.invoke('backup:restore', { backupDir })
});
