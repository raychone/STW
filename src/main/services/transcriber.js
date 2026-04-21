const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function hasFfmpeg() {
  const run = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return run.status === 0;
}

function convertToWavIfNeeded(audioPath, tempDir) {
  const ext = path.extname(audioPath).toLowerCase();
  if (ext === '.wav') {
    return audioPath;
  }

  if (!hasFfmpeg()) {
    throw new Error(
      'Audio chunk este non-WAV, dar ffmpeg nu este instalat. Instalează ffmpeg pentru transcriere reală.'
    );
  }

  const outputPath = path.join(tempDir, `audio-${Date.now()}.wav`);
  const run = spawnSync(
    'ffmpeg',
    ['-y', '-i', audioPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputPath],
    { encoding: 'utf8' }
  );

  if (run.status !== 0 || !fs.existsSync(outputPath)) {
    const stderr = run.stderr || run.stdout || 'Conversie ffmpeg eșuată.';
    throw new Error(stderr.trim());
  }

  return outputPath;
}

function validateWhisperSetup({ whisperCppPath, whisperModelPath }) {
  if (!whisperCppPath || !whisperModelPath) {
    throw new Error('Setările pentru whisper.cpp nu sunt complete (cale executabil + model).');
  }
  if (!fs.existsSync(whisperCppPath)) {
    throw new Error(`Executabilul whisper.cpp nu există: ${whisperCppPath}`);
  }
  if (!fs.existsSync(whisperModelPath)) {
    throw new Error(`Modelul whisper nu există: ${whisperModelPath}`);
  }
}

function transcribeWithWhisperCpp({ audioPath, whisperCppPath, whisperModelPath, tempDir }) {
  validateWhisperSetup({ whisperCppPath, whisperModelPath });
  const whisperAudioPath = convertToWavIfNeeded(audioPath, tempDir);

  const prefix = path.join(tempDir, `transcript-${Date.now()}`);
  const args = ['-m', whisperModelPath, '-f', whisperAudioPath, '-l', 'ro', '-otxt', '-of', prefix];
  const run = spawnSync(whisperCppPath, args, { encoding: 'utf8' });

  if (run.status !== 0) {
    const stderr = run.stderr || run.stdout || 'Eroare necunoscută whisper.cpp';
    throw new Error(stderr.trim());
  }

  const outputPath = `${prefix}.txt`;
  if (!fs.existsSync(outputPath)) {
    throw new Error('whisper.cpp nu a generat fișierul de transcript.');
  }

  const text = fs.readFileSync(outputPath, 'utf8').trim();
  if (!text) {
    throw new Error('Transcriptul returnat de whisper.cpp este gol.');
  }

  return {
    rawText: text,
    engineUsed: 'whispercpp'
  };
}

function transcribeAudio({ audioPath, settings, tempDir }) {
  const engine = settings.sttEngine || 'mock';

  if (engine === 'whispercpp') {
    return transcribeWithWhisperCpp({
      audioPath,
      whisperCppPath: settings.whisperCppPath,
      whisperModelPath: settings.whisperModelPath,
      tempDir
    });
  }

  return {
    rawText:
      '[Transcriere locală indisponibilă: configurează whisper.cpp în Settings pentru text real în română.]',
    engineUsed: 'mock'
  };
}

function testWhisperSetup({ settings }) {
  const whisperCppPath = settings.whisperCppPath;
  const whisperModelPath = settings.whisperModelPath;
  validateWhisperSetup({ whisperCppPath, whisperModelPath });

  const run = spawnSync(whisperCppPath, ['--help'], { encoding: 'utf8' });
  if (run.status !== 0) {
    const stderr = run.stderr || run.stdout || 'Executabil whisper.cpp nu rulează corect.';
    throw new Error(stderr.trim());
  }

  return {
    ok: true,
    ffmpegInstalled: hasFfmpeg(),
    message: 'Setup whisper.cpp validat. Poți testa dictarea reală.'
  };
}

module.exports = {
  transcribeAudio,
  testWhisperSetup,
  hasFfmpeg
};
