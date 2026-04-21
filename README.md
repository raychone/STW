# SpeechToWrite Local

Aplicație desktop locală pentru tehnoredactare în limba română, rulată direct pe laptop, fără deploy web.

## Ce este implementat acum

Data update: 2026-04-21 (Europe/Paris)

1. Electron desktop app local (macOS/Windows).
2. Persistență locală `SQLite` pentru proiecte, secțiuni, sesiuni, chunk-uri, transcrieri, exporturi, setări.
3. Workflow complet proiect: creare proiect -> secțiuni -> editor -> dictare incrementală -> export DOCX.
4. Dictare din microfon laptop + chunk audio local + transcriere locală engine configurabil (`mock` / `whisper.cpp`).
5. Normalizare text RO cu diacritice conservative + glosar custom (global + per proiect).
6. Căutare/înlocuire (`Replace all`) în secțiunea curentă.
7. Istoric sesiuni recente în UI.
8. Backup local on-demand din UI.
9. Restore backup selectat (cu backup de siguranță și relansare automată).
10. Diagnostics STT în UI (`Verificare sistem`) pentru readiness dictare reală.
11. Teste automate locale (`npm test`) pentru normalizare + DB flow (cu skip controlat pe incompatibilități de mediu).

## Unde sunt datele

Datele sunt salvate în folderul nativ de aplicație:
1. macOS: `~/Library/Application Support/SpeechToWrite Local/`
2. Windows: `%APPDATA%\SpeechToWrite Local\`

Structură:
1. `data/app.db` (SQLite)
2. `projects/<project_id>/audio/` (audio sesiuni)
3. `exports/` (DOCX)
4. `backups/` (backup-uri locale)

## Rulare locală

1. `npm install`
2. `npm start`
3. verificare sintaxă: `npm run check`
4. teste automate: `npm test`

## Build desktop

1. macOS DMG: `npm run build:mac`
2. Windows installer NSIS: `npm run build:win`
3. QA complet macOS (checks + test + build): `npm run qa:mac`
4. QA complet Windows (checks + test + build): `npm run qa:win`
5. Build Windows în GitHub Actions: workflow `.github/workflows/build-win.yml`

Notă: în mod normal, build-ul mac se face pe macOS, iar build-ul Windows pe Windows/CI.

## Cum folosești funcțiile noi

### Glosar diacritice

1. Selectezi proiectul.
2. În panoul `Glosar diacritice` alegi `project` sau `global`.
3. Adaugi `source` (ex: `bucuresti`) și `target` (ex: `București`).
4. Termenul va fi aplicat automat în normalizarea transcriptului.

### Search/Replace

1. În editorul secțiunii completezi `Caută` și `Înlocuiește cu`.
2. Apeși `Replace all`.
3. Textul este salvat automat în secțiunea curentă.

### Backup

1. Apeși `Creează backup`.
2. Se generează un folder timestamped în `backups/` cu DB + audio proiecte.
3. Pentru restore: selectezi un backup din listă și apeși `Restore backup selectat`.
4. Aplicația face backup de siguranță (`pre-restore-*`) și apoi se relansează automat.

## Configurare transcriere locală reală (whisper.cpp)

1. Instalezi/compilezi `whisper.cpp` și ai executabilul `whisper-cli`.
2. Descarci model local (`ggml-*.bin`).
3. În UI, la `Setări STT local`:
   - `Engine = whispercpp`
   - setezi calea executabilului
   - setezi calea modelului
   - `Salvează setări`
   - `Testează setup STT`

Dacă engine-ul e `mock`, audio se salvează local, dar textul este fallback.

Pentru dictare reală:
1. Dacă `Testează setup STT` este OK, poți dicta imediat și aplicația va insera textul transcris.
2. Pentru chunk-uri `webm`, este recomandat să ai `ffmpeg` instalat (aplicația îl detectează la test).
3. `Verificare sistem` îți arată instant dacă setup-ul e complet (`Ready dictare reală: DA/NU`).

## Troubleshooting

1. Dacă `npm start` dă eroare Electron API: `unset ELECTRON_RUN_AS_NODE`.
2. Dacă transcrierea eșuează pe `whispercpp`, verifică exact căile din setări.
3. Dacă microfonul nu merge, verifică permisiunile OS pentru aplicație.
4. Dacă `npm run qa:mac` sau `npm run build:mac` eșuează cu `EPERM` pe `~/.npm` / `~/.electron-gyp`, rulează:
   - `mkdir -p ~/.npm ~/.electron-gyp`
   - `sudo chown -R "$USER" ~/.npm ~/.electron-gyp`
   - `chmod -R u+rwX ~/.npm ~/.electron-gyp`

## Finalizare plan

1. Pentru închiderea planului folosește checklist-ul: `ACCEPTANCE_CHECKLIST.md`.
2. Pentru pașii de build+validare finală pe OS, folosește: `FINAL_QA_RUNBOOK.md`.

## Livrare `.exe` din GitHub Actions

1. Mergi în repo -> `Actions` -> `Build Windows Installer`.
2. Rulezi workflow-ul manual (`Run workflow`) sau faci push de tag `v*`.
3. La final, descarci artifact-ul `windows-installer`.
4. În artifact vei găsi installer-ul `.exe` pe care îl poți trimite direct utilizatorului Windows.
5. Workflow-ul este actualizat pentru runtime Node 24 la nivel de GitHub Actions (compatibil cu deprecarea Node 20 pe runner).
