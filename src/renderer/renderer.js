let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;
let analyser = null;
let meterTimer = null;
let durationTimer = null;
let startedAt = 0;
let activeSession = null;
const audioChunks = [];

const state = {
  projects: [],
  sections: [],
  sessions: [],
  glossary: {
    globalTerms: [],
    projectTerms: []
  },
  backups: [],
  selectedBackupPath: null,
  selectedProjectId: null,
  selectedSectionId: null,
  settings: {
    sttEngine: 'mock',
    whisperCppPath: '',
    whisperModelPath: ''
  }
};

const el = {
  newProjectTitle: document.getElementById('newProjectTitle'),
  createProjectBtn: document.getElementById('createProjectBtn'),
  projectsList: document.getElementById('projectsList'),
  projectTitle: document.getElementById('projectTitle'),
  exportDocxBtn: document.getElementById('exportDocxBtn'),
  newSectionTitle: document.getElementById('newSectionTitle'),
  createSectionBtn: document.getElementById('createSectionBtn'),
  sectionsList: document.getElementById('sectionsList'),
  editorSectionTitle: document.getElementById('editorSectionTitle'),
  editor: document.getElementById('editor'),
  searchInput: document.getElementById('searchInput'),
  replaceInput: document.getElementById('replaceInput'),
  replaceBtn: document.getElementById('replaceBtn'),
  saveEditorBtn: document.getElementById('saveEditorBtn'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  status: document.getElementById('status'),
  duration: document.getElementById('duration'),
  level: document.getElementById('level'),
  meter: document.getElementById('meter'),
  engineUsed: document.getElementById('engineUsed'),
  lastTranscript: document.getElementById('lastTranscript'),
  lastMessage: document.getElementById('lastMessage'),
  sessionsList: document.getElementById('sessionsList'),
  sttEngine: document.getElementById('sttEngine'),
  whisperCppPath: document.getElementById('whisperCppPath'),
  whisperModelPath: document.getElementById('whisperModelPath'),
  pickWhisperExecBtn: document.getElementById('pickWhisperExecBtn'),
  pickWhisperModelBtn: document.getElementById('pickWhisperModelBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  autoConfigureWhisperBtn: document.getElementById('autoConfigureWhisperBtn'),
  testWhisperBtn: document.getElementById('testWhisperBtn'),
  runDiagnosticsBtn: document.getElementById('runDiagnosticsBtn'),
  diagnosticsText: document.getElementById('diagnosticsText'),
  glossaryScope: document.getElementById('glossaryScope'),
  glossarySource: document.getElementById('glossarySource'),
  glossaryTarget: document.getElementById('glossaryTarget'),
  addGlossaryBtn: document.getElementById('addGlossaryBtn'),
  glossaryList: document.getElementById('glossaryList'),
  createBackupBtn: document.getElementById('createBackupBtn'),
  restoreBackupBtn: document.getElementById('restoreBackupBtn'),
  backupsList: document.getElementById('backupsList')
};

function setStatus(text) {
  el.status.textContent = text;
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSelectedProject() {
  return state.projects.find((p) => p.id === state.selectedProjectId) || null;
}

function getSelectedSection() {
  return state.sections.find((s) => s.id === state.selectedSectionId) || null;
}

function renderProjects() {
  el.projectsList.innerHTML = '';
  state.projects.forEach((project) => {
    const li = document.createElement('li');
    li.textContent = project.title;
    if (project.id === state.selectedProjectId) {
      li.classList.add('active');
    }
    li.addEventListener('click', async () => {
      await selectProject(project.id);
    });
    el.projectsList.appendChild(li);
  });
}

function renderSections() {
  el.sectionsList.innerHTML = '';
  state.sections.forEach((section) => {
    const li = document.createElement('li');
    li.textContent = section.title;
    if (section.id === state.selectedSectionId) {
      li.classList.add('active');
    }
    li.addEventListener('click', () => {
      selectSection(section.id);
    });
    el.sectionsList.appendChild(li);
  });
}

function renderSessions() {
  el.sessionsList.innerHTML = '';
  if (!state.sessions.length) {
    const li = document.createElement('li');
    li.textContent = 'Nu există sesiuni încă.';
    el.sessionsList.appendChild(li);
    return;
  }

  state.sessions.slice(0, 8).forEach((session) => {
    const li = document.createElement('li');
    const ended = session.ended_at ? new Date(session.ended_at).toLocaleString() : 'în curs';
    li.textContent = `#${session.id} ${session.section_title} - ${ended}`;
    el.sessionsList.appendChild(li);
  });
}

function renderProjectHeader() {
  const project = getSelectedProject();
  el.projectTitle.textContent = project ? project.title : 'Selectează un proiect';
  const hasProject = Boolean(project);
  el.exportDocxBtn.disabled = !hasProject;
  el.createSectionBtn.disabled = !hasProject;
  el.addGlossaryBtn.disabled = !hasProject;
}

function renderEditor() {
  const section = getSelectedSection();
  const hasSection = Boolean(section);
  el.editor.disabled = !hasSection;
  el.saveEditorBtn.disabled = !hasSection;
  el.startBtn.disabled = !hasSection;
  el.replaceBtn.disabled = !hasSection;
  el.editorSectionTitle.textContent = hasSection ? `Editor - ${section.title}` : 'Editor';
  el.editor.value = hasSection ? section.content || '' : '';
}

function renderSettings() {
  el.sttEngine.value = state.settings.sttEngine || 'mock';
  el.whisperCppPath.value = state.settings.whisperCppPath || '';
  el.whisperModelPath.value = state.settings.whisperModelPath || '';
}

function renderGlossary() {
  el.glossaryList.innerHTML = '';
  const all = [...state.glossary.projectTerms, ...state.glossary.globalTerms];

  if (!all.length) {
    const li = document.createElement('li');
    li.textContent = 'Nu există termeni în glosar.';
    el.glossaryList.appendChild(li);
    return;
  }

  all.forEach((term) => {
    const li = document.createElement('li');
    const meta = term.scope === 'global' ? '[global]' : '[project]';
    li.textContent = `${meta} ${term.source} -> ${term.target} `;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Șterge';
    removeBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await window.localApi.deleteGlossaryTerm(term.id);
      await loadGlossary();
      setStatus('Termen șters din glosar.');
    });

    li.appendChild(removeBtn);
    el.glossaryList.appendChild(li);
  });
}

function renderBackups() {
  el.backupsList.innerHTML = '';
  el.restoreBackupBtn.disabled = !state.selectedBackupPath;
  if (!state.backups.length) {
    const li = document.createElement('li');
    li.textContent = 'Nu există backup-uri.';
    el.backupsList.appendChild(li);
    return;
  }

  state.backups.slice(0, 6).forEach((backupPath) => {
    const li = document.createElement('li');
    li.textContent = backupPath;
    if (state.selectedBackupPath === backupPath) {
      li.classList.add('active');
    }
    li.addEventListener('click', () => {
      state.selectedBackupPath = backupPath;
      renderBackups();
    });
    el.backupsList.appendChild(li);
  });
}

function updateSectionInState(updatedSection) {
  state.sections = state.sections.map((s) => (s.id === updatedSection.id ? updatedSection : s));
}

function cleanupAudioGraph() {
  if (meterTimer) {
    clearInterval(meterTimer);
    meterTimer = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  analyser = null;
  el.meter.style.width = '0%';
  el.level.textContent = '0%';
}

function cleanupDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

function stopTracks() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

function startDurationTicker() {
  startedAt = Date.now();
  cleanupDurationTimer();
  durationTimer = setInterval(() => {
    el.duration.textContent = formatDuration(Date.now() - startedAt);
  }, 200);
}

async function loadGlossary() {
  const project = getSelectedProject();
  if (!project) {
    state.glossary = { globalTerms: [], projectTerms: [] };
    renderGlossary();
    return;
  }
  state.glossary = await window.localApi.listGlossary(project.id);
  renderGlossary();
}

async function loadBackups() {
  state.backups = await window.localApi.listBackups();
  if (!state.selectedBackupPath || !state.backups.includes(state.selectedBackupPath)) {
    state.selectedBackupPath = state.backups.length ? state.backups[0] : null;
  }
  renderBackups();
}

async function selectProject(projectId) {
  const detail = await window.localApi.getProjectDetail(projectId);
  state.selectedProjectId = detail.project.id;
  state.sections = detail.sections;
  state.sessions = detail.sessions;
  state.selectedSectionId = detail.sections.length ? detail.sections[0].id : null;

  renderProjects();
  renderSections();
  renderSessions();
  renderProjectHeader();
  renderEditor();
  await loadGlossary();
}

function selectSection(sectionId) {
  state.selectedSectionId = sectionId;
  renderSections();
  renderEditor();
}

async function refreshProjectsAndKeepSelection() {
  const current = state.selectedProjectId;
  state.projects = await window.localApi.listProjects();

  if (!state.projects.length) {
    state.selectedProjectId = null;
    state.sections = [];
    state.selectedSectionId = null;
    state.sessions = [];
    renderProjects();
    renderSections();
    renderSessions();
    renderProjectHeader();
    renderEditor();
    await loadGlossary();
    return;
  }

  if (current && state.projects.some((p) => p.id === current)) {
    await selectProject(current);
  } else {
    await selectProject(state.projects[0].id);
  }
}

async function createProject() {
  const title = el.newProjectTitle.value.trim();
  if (!title) {
    setStatus('Introdu un titlu pentru proiect.');
    return;
  }

  await window.localApi.createProject(title);
  el.newProjectTitle.value = '';
  await refreshProjectsAndKeepSelection();
  setStatus('Proiect creat.');
}

async function createSection() {
  const project = getSelectedProject();
  if (!project) {
    setStatus('Selectează mai întâi un proiect.');
    return;
  }

  const title = el.newSectionTitle.value.trim();
  if (!title) {
    setStatus('Introdu titlul secțiunii.');
    return;
  }

  const section = await window.localApi.createSection(project.id, title, null);
  state.sections.push(section);
  state.selectedSectionId = section.id;
  el.newSectionTitle.value = '';
  renderSections();
  renderEditor();
  await refreshProjectsAndKeepSelection();
  setStatus('Secțiune adăugată.');
}

async function saveEditor() {
  const section = getSelectedSection();
  if (!section) {
    return;
  }

  const updated = await window.localApi.updateSectionContent(section.id, el.editor.value);
  updateSectionInState(updated);
  setStatus('Text salvat.');
}

async function replaceInEditor() {
  const section = getSelectedSection();
  if (!section) {
    return;
  }

  const searchValue = el.searchInput.value;
  if (!searchValue) {
    setStatus('Introdu textul de căutare.');
    return;
  }
  const replaceValue = el.replaceInput.value;
  const regex = new RegExp(escapeRegExp(searchValue), 'g');
  const updatedText = el.editor.value.replace(regex, replaceValue);
  el.editor.value = updatedText;
  await saveEditor();
  setStatus('Replace finalizat și salvat.');
}

async function exportDocx() {
  const project = getSelectedProject();
  if (!project) {
    return;
  }

  setStatus('Export DOCX în curs...');
  const result = await window.localApi.exportDocx(project.id);
  setStatus(`Export finalizat: ${result.filePath}`);
  el.lastMessage.textContent = `DOCX: ${result.filePath}`;
  await window.localApi.showExportInFolder(result.filePath);
}

async function saveSettings() {
  const next = {
    sttEngine: el.sttEngine.value,
    whisperCppPath: el.whisperCppPath.value.trim(),
    whisperModelPath: el.whisperModelPath.value.trim()
  };
  state.settings = await window.localApi.updateSettings(next);
  renderSettings();
  setStatus('Setări STT salvate.');
}

async function testWhisperSetup() {
  try {
    const result = await window.localApi.testWhisperSetup({
      sttEngine: el.sttEngine.value,
      whisperCppPath: el.whisperCppPath.value.trim(),
      whisperModelPath: el.whisperModelPath.value.trim()
    });
    const ffmpegMsg = result.ffmpegInstalled
      ? 'ffmpeg detectat (ok pentru chunk-uri webm).'
      : 'ffmpeg nedetectat: recomandat pentru conversie audio.';
    setStatus(`${result.message} ${ffmpegMsg}`);
    el.lastMessage.classList.remove('warn');
    el.lastMessage.textContent = `Test STT: OK. ${ffmpegMsg}`;
  } catch (error) {
    setStatus(`Test STT eșuat: ${error.message || 'necunoscut'}`);
    el.lastMessage.classList.add('warn');
    el.lastMessage.textContent = `Test STT eșuat: ${error.message || 'necunoscut'}`;
  }
}

async function pickWhisperExecutable() {
  const result = await window.localApi.pickWhisperExecutable();
  if (!result.canceled && result.path) {
    el.whisperCppPath.value = result.path;
    setStatus('Executabil selectat. Salvează setările.');
  }
}

async function pickWhisperModel() {
  const result = await window.localApi.pickWhisperModel();
  if (!result.canceled && result.path) {
    el.whisperModelPath.value = result.path;
    setStatus('Model selectat. Salvează setările.');
  }
}

async function autoConfigureWhisper() {
  const result = await window.localApi.autoConfigureWhisper();
  if (!result.ok) {
    setStatus(result.message);
    el.lastMessage.classList.add('warn');
    el.lastMessage.textContent = result.message;
    return;
  }
  state.settings = result.settings;
  renderSettings();
  setStatus(result.message);
  el.lastMessage.classList.remove('warn');
  el.lastMessage.textContent = `${result.message} Verifică și apasă Testează setup STT.`;
}

async function runDiagnostics() {
  const result = await window.localApi.getDiagnostics();
  const lines = [
    `Engine: ${result.sttEngine}`,
    `Exec configurat: ${result.whisperExecConfigured ? 'da' : 'nu'}`,
    `Model configurat: ${result.whisperModelConfigured ? 'da' : 'nu'}`,
    `Exec există: ${result.whisperExecExists ? 'da' : 'nu'}`,
    `Model există: ${result.whisperModelExists ? 'da' : 'nu'}`,
    `ffmpeg instalat: ${result.ffmpegInstalled ? 'da' : 'nu'}`,
    `Proiecte: ${result.projectsCount}`,
    `Ready dictare reală: ${result.readyForRealDictation ? 'DA' : 'NU'}`
  ];
  el.diagnosticsText.textContent = lines.join(' | ');
  if (result.readyForRealDictation) {
    setStatus('Sistem pregătit pentru dictare reală.');
  } else {
    setStatus('Sistemul nu este încă pregătit pentru dictare reală.');
  }
}

async function addGlossaryTerm() {
  const project = getSelectedProject();
  if (!project) {
    setStatus('Selectează un proiect pentru glosar.');
    return;
  }

  const scope = el.glossaryScope.value;
  const source = el.glossarySource.value.trim();
  const target = el.glossaryTarget.value.trim();
  if (!source || !target) {
    setStatus('Completează sursa și ținta în glosar.');
    return;
  }

  await window.localApi.upsertGlossaryTerm({
    scope,
    projectId: project.id,
    source,
    target
  });

  el.glossarySource.value = '';
  el.glossaryTarget.value = '';
  await loadGlossary();
  setStatus('Termen adăugat/actualizat în glosar.');
}

async function createBackup() {
  const result = await window.localApi.createBackup();
  await loadBackups();
  setStatus(`Backup creat: ${result.backupDir}`);
}

async function restoreBackup() {
  if (!state.selectedBackupPath) {
    setStatus('Selectează un backup din listă.');
    return;
  }
  await window.localApi.restoreBackup(state.selectedBackupPath);
  setStatus('Restore inițiat. Aplicația se va relansa.');
}

async function startRecording() {
  const project = getSelectedProject();
  const section = getSelectedSection();
  if (!project || !section) {
    setStatus('Selectează proiect și secțiune.');
    return;
  }

  audioChunks.length = 0;
  el.lastTranscript.textContent = '-';
  el.lastMessage.textContent = '-';

  try {
    activeSession = await window.localApi.startSession(project.id, section.id);
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    meterTimer = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const pct = Math.max(0, Math.min(100, Math.round(rms * 220)));
      el.meter.style.width = `${pct}%`;
      el.level.textContent = `${pct}%`;
    }, 90);

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      setStatus('Procesare chunk local...');
      const durationMs = Date.now() - startedAt;
      cleanupAudioGraph();
      cleanupDurationTimer();
      stopTracks();

      try {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const result = await window.localApi.processChunk({
          sessionId: activeSession.id,
          projectId: project.id,
          sectionId: section.id,
          bytes: Array.from(bytes),
          extension: 'webm',
          durationMs
        });

        await window.localApi.endSession(activeSession.id);

        el.engineUsed.textContent = result.engineUsed || '-';
        if (result.ok && result.updatedSection) {
          updateSectionInState(result.updatedSection);
          if (state.selectedSectionId === result.updatedSection.id) {
            el.editor.value = result.updatedSection.content || '';
          }
          el.lastTranscript.textContent = result.normalizedText;
          if (result.transcriptionError) {
            el.lastMessage.textContent = result.transcriptionError;
            el.lastMessage.classList.add('warn');
          } else {
            el.lastMessage.textContent = `Audio salvat: ${result.audioPath}`;
            el.lastMessage.classList.remove('warn');
          }
          setStatus('Dictare procesată și adăugată în secțiune.');
        } else {
          const msg = result.transcriptionError || 'Nu s-a generat transcript.';
          el.lastMessage.textContent = msg;
          el.lastMessage.classList.add('warn');
          setStatus('Audio salvat, dar transcrierea a eșuat.');
        }

        await refreshProjectsAndKeepSelection();
      } catch (error) {
        setStatus(`Eroare procesare: ${error.message || 'necunoscut'}`);
      } finally {
        activeSession = null;
      }
    };

    mediaRecorder.start(1000);
    startDurationTicker();
    setStatus('Înregistrare activă.');
    el.startBtn.disabled = true;
    el.stopBtn.disabled = false;
  } catch (error) {
    setStatus(`Eroare start dictare: ${error.message || 'necunoscut'}`);
    stopTracks();
    cleanupDurationTimer();
    cleanupAudioGraph();
    if (activeSession && activeSession.id) {
      await window.localApi.endSession(activeSession.id);
    }
    activeSession = null;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  el.startBtn.disabled = false;
  el.stopBtn.disabled = true;
}

async function bootstrap() {
  const data = await window.localApi.bootstrap();
  state.projects = data.projects || [];
  state.settings = data.settings || state.settings;
  renderSettings();

  if (state.projects.length) {
    await selectProject(state.projects[0].id);
  } else {
    renderProjects();
    renderSections();
    renderSessions();
    renderProjectHeader();
    renderEditor();
    renderGlossary();
  }

  await loadBackups();
  setStatus(`Ready. Baza locală: ${data.dbPath}`);
}

el.createProjectBtn.addEventListener('click', createProject);
el.createSectionBtn.addEventListener('click', createSection);
el.saveEditorBtn.addEventListener('click', saveEditor);
el.replaceBtn.addEventListener('click', replaceInEditor);
el.exportDocxBtn.addEventListener('click', exportDocx);
el.saveSettingsBtn.addEventListener('click', saveSettings);
el.pickWhisperExecBtn.addEventListener('click', pickWhisperExecutable);
el.pickWhisperModelBtn.addEventListener('click', pickWhisperModel);
el.autoConfigureWhisperBtn.addEventListener('click', autoConfigureWhisper);
el.testWhisperBtn.addEventListener('click', testWhisperSetup);
el.runDiagnosticsBtn.addEventListener('click', runDiagnostics);
el.addGlossaryBtn.addEventListener('click', addGlossaryTerm);
el.createBackupBtn.addEventListener('click', createBackup);
el.restoreBackupBtn.addEventListener('click', restoreBackup);
el.startBtn.addEventListener('click', startRecording);
el.stopBtn.addEventListener('click', stopRecording);

bootstrap().catch((error) => {
  setStatus(`Eroare bootstrap: ${error.message || 'necunoscut'}`);
});
