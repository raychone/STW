## UPDATE IMPLEMENTARE (instanța: 2026-04-21, Europe/Paris)

### Ce s-a făcut acum

1. Arhitectură locală implementată în `Electron` + servicii backend locale.
2. Persistență locală `SQLite` implementată (`projects`, `sections`, `dictation_sessions`, `audio_chunks`, `transcript_chunks`, `exports`, `settings`).
3. UI complet pentru proiecte/secțiuni/editor text incremental.
4. Dictare din microfon laptop: start/stop, nivel semnal, durată, salvare chunk audio local.
5. Workflow incremental implementat: sesiuni multiple pe aceeași secțiune, append text în etape.
6. Integrare STT local prin engine configurabil (`mock` / `whisper.cpp`).
7. Pipeline post-procesare text RO implementat (normalizare spații/punctuație + reguli diacritice conservative).
8. Export DOCX local implementat.
9. Persistență mutată pe path nativ desktop per OS (userData), pentru rulare corectă ca aplicație instalată.
10. Pregătire packaging desktop cross-platform (`build:mac` pentru DMG, `build:win` pentru installer NSIS).
11. Glosar custom diacritice implementat (`global` + `project`), aplicat la normalizare.
12. Search/Replace (`Replace all`) în editorul secțiunii curente.
13. Istoric sesiuni recente afișat în UI.
14. Backup local on-demand (DB + proiecte/audio) din UI.
15. README actualizat pentru fluxul desktop și noile funcții.
16. Setup test pentru STT local în UI (`Testează setup STT`) + validare `ffmpeg` pentru conversie chunk-uri audio.
17. Restore backup implementat în UI + backend (cu backup de siguranță înainte de restore și relansare automată app).
18. Diagnostics STT implementat în UI (`Verificare sistem`) pentru readiness dictare reală.
19. Teste automate locale adăugate (`npm test`) + validare de sintaxă (`npm run check`).
20. Checklist formal de acceptanță adăugat în root (`ACCEPTANCE_CHECKLIST.md`) pentru închiderea planului.
21. Scripturi QA cross-platform adăugate (`qa:mac`, `qa:win`) pentru flux complet check+test+build.
22. Runbook final de validare adăugat (`FINAL_QA_RUNBOOK.md`).
23. Execuție `qa:mac` efectuată complet cu succes: `check` + `test` + build DMG (`dist/SpeechToWrite Local-0.1.0.dmg`).

### Ce este finalizat din plan

1. Etapa 1 finalizată: infrastructură locală gratuită + captură audio stabilă.
2. Etapa 2 finalizată: proiecte/secțiuni/editor + persistare + sesiuni de dictare.
3. Rest MVP finalizat: STT local configurabil + normalizare text + export DOCX.
4. Hardening intermediar finalizat: glosar custom, search/replace, backup local, istoric sesiuni.
5. Flux de activare dictare reală accelerat: verificare setup whisper.cpp direct din UI.
6. Ciclul backup/restore este complet funcțional în aplicație.
7. Stabilizare de bază acoperită: diagnostics runtime + suită minimă de teste automate.

### Ce mai rămâne din plan (următoarele etape)

1. Configurare efectivă `whisper.cpp` pe laptopul tău (cale executabil + model real).
2. Extindere glosar pe vocabularul tău real (iterații pe date dictare reale).
3. Testare de acceptanță pe documente de 30-100 pagini (în utilizarea ta reală) + reglaj performanță (CPU/RAM).
4. Execuție finală runbook QA pe Windows + bifare integrală checklist.
5. Fine-tuning UX final după feedback real (mesaje, etichete, onboarding).

---

# Plan Arhitectură Full-Stack — Aplicație de Tehnoredactare prin Dictare (RO cu diacritice)

## 1. Obiectiv produs

Construirea unei aplicații desktop-first (rulată pe laptop, utilizator unic) pentru tehnoredactare de proiecte lungi în format DOCX, unde utilizatorul dictează în limba română (cu diacritice) în sesiuni multiple, iar conținutul se acumulează etapizat până la finalizarea proiectului.

## 2. Cerințe cheie (din business)

1. Dictare în limba română cu diacritice corecte (`ăâîșț`).
2. Lucru pe proiecte mari (zeci de pagini).
3. Flux incremental: dictare în etape, continuare ulterioară, revizii și completări.
4. Organizare pe proiecte/sectiuni/capitole.
5. Export final în DOCX, cu structură clară.
6. Rulare stabilă pe laptop (resurse limitate, 100% local/offline).
7. Infrastructură gratuită (fără costuri lunare cloud/API).
8. Captură voce direct din microfonul laptopului.

## 3. Viziune arhitecturală

### 3.1 Tip aplicație

- **Desktop app** bazată pe web stack:
  - UI: `React + TypeScript`
  - Runtime desktop: `Electron` (sau Tauri ca alternativă mai lightweight)
  - API local: `Node.js` (proces principal/local service)
  - DB locală: `SQLite`

Motiv: ușor de distribuit pe laptop, persistă local datele, UX modern, control pe fișiere și export.

### 3.2 Stil arhitectural

- **Modular monolith local** (pentru început):
  - `Transcription Module`
  - `Document Composer Module`
  - `Project Management Module`
  - `Export Module`
  - `Storage Module`

Avantaj: complexitate redusă, dezvoltare rapidă, fără overhead de microservicii.

## 4. Componente principale

### 4.1 Frontend (Desktop UI)

- Dashboard proiecte.
- Ecran proiect cu:
  - Arbore secțiuni/capitole.
  - Editor text (cu stiluri minime: Heading, paragraf, listă).
  - Panou dictare (start/pause/stop, nivel semnal, timer sesiune).
  - Istoric sesiuni dictare și inserții.
- Căutare și înlocuire în proiect.
- Marcaje pentru revizie.

### 4.2 Backend local (Application Core)

- Orchestrare sesiuni audio.
- Trimitere audio către motor STT local (on-device).
- Post-procesare text RO:
  - normalizare punctuație,
  - corecții diacritice,
  - reguli contextual-lingvistice.
- Versionare document (snapshot incremental).
- Generare DOCX.

### 4.3 Persistență

- `SQLite` cu tabele pentru:
  - `projects`
  - `sections`
  - `document_blocks`
  - `dictation_sessions`
  - `audio_chunks`
  - `transcript_chunks`
  - `revisions`
  - `exports`
- Fișiere audio stocate local în `project_data/<project_id>/audio/`.

### 4.4 STT (Speech-to-Text) local gratuit

Mod unic (v1):

1. **Local STT on-device (fără cloud):**
   - rulare pe laptop, fără upload audio,
   - motor recomandat: `faster-whisper` / `whisper.cpp` cu model compatibil `ro`,
   - configurare model după performanța laptopului (`small`/`medium`).

### 4.5 Input audio din microfonul laptopului

1. Captură audio direct din microfonul intern (default device OS).
2. Selector manual de input audio (în cazul unui microfon extern).
3. VU meter + test microfon în settings înainte de dictare.
4. Noise gate și VAD pentru a reduce pauzele/zgomotul de fundal.

## 5. Flux funcțional end-to-end

1. Utilizatorul creează proiect nou.
2. Definește structură inițială (capitole/secțiuni).
3. Pornește sesiune dictare pe secțiunea activă.
4. Audio este tăiat în chunk-uri (ex: 20-40 sec), trimis la STT.
5. Transcriptul chunk-urilor este concatenat cu post-procesare RO (diacritice + punctuație).
6. Textul este inserat în secțiunea selectată.
7. Utilizatorul oprește sesiunea; aplicația salvează snapshot și metadate.
8. În sesiuni viitoare, utilizatorul reia proiectul și continuă dictarea pe aceeași secțiune sau alta.
9. La final, export DOCX cu structură coerentă și cuprins (opțional).

## 6. Model de date (v1)

### 6.1 Entități

- `Project`: id, title, client, status, created_at, updated_at.
- `Section`: id, project_id, parent_id, title, order_index.
- `DocumentBlock`: id, section_id, type(paragraph/heading/list), content, order_index.
- `DictationSession`: id, project_id, section_id, started_at, ended_at, language(`ro-RO`), notes.
- `AudioChunk`: id, session_id, file_path, duration_ms, seq.
- `TranscriptChunk`: id, audio_chunk_id, raw_text, normalized_text, confidence, seq.
- `Revision`: id, project_id, snapshot_json, created_at, reason.
- `Export`: id, project_id, format(`docx`), file_path, created_at.

### 6.2 Principii

- Nu se pierde text: fiecare chunk are `raw_text` + `normalized_text`.
- Orice sesiune are audit trail (ce s-a adăugat, când, unde).
- Snapshots periodice pentru rollback rapid.

## 7. Calitate limbă română (diacritice)

### 7.1 Pipeline text

1. Transcript brut STT.
2. Normalizare spații și semne de punctuație.
3. Corecție diacritice (lexicon + model contextual).
4. Reguli pentru termeni tehnici (dicționar custom per proiect/client).
5. Validare finală înainte de inserare în document.

### 7.2 Dicționare custom

- Glosar global (tehnoredactare).
- Glosar per proiect (nume proprii, termeni de domeniu).
- Posibilitate “învață acest termen” din UI.

## 8. Performanță și scalare locală

1. Chunking audio și procesare asincronă (nu blochează UI).
2. Lazy loading pentru documente mari.
3. Editor virtualizat pe blocuri pentru zeci de pagini.
4. Auto-save incremental la 5-10 sec + la fiecare chunk confirmat.
5. Compresie/rotire pentru fișiere audio lungi.

## 9. Securitate și confidențialitate

1. Date locale criptate (cel puțin DB encryption + fișiere sensibile).
2. Nu sunt necesare chei/API tokens pentru funcționarea de bază.
3. Funcționare implicită offline (fără upload audio).
4. Logging minim, fără conținut integral sensibil în loguri.

## 10. Tehnologii recomandate

- `Electron + React + TypeScript`
- `Node.js` (main process + local backend services)
- `SQLite` (cu ORM: Prisma/Drizzle)
- `TipTap` sau `Lexical` (editor document)
- `docx` (npm package) pentru export DOCX
- `VAD` (voice activity detection) pentru delimitare inteligentă chunk-uri
- `faster-whisper` (Python service local) sau `whisper.cpp` (C++ binar local)
- Captură microfon: Web Audio/MediaDevices prin Electron + permisiuni OS

## 11. Roadmap implementare

### Faza 0 — Discovery local (3-5 zile)

1. Test comparativ `faster-whisper` vs `whisper.cpp` pe mostre reale RO.
2. Benchmark acuratețe diacritice + latență + consum CPU/RAM.
3. Decizie stack finală și schemă DB.

### Faza 1 — MVP funcțional (2-4 săptămâni)

1. Creare proiect, secțiuni, editor simplu.
2. Înregistrare audio din microfonul laptopului + chunking + transcriere live-ish locală.
3. Inserare text în secțiune activă.
4. Salvare sesiuni + istoric.
5. Export DOCX de bază.

### Faza 2 — Productivitate pentru proiecte mari (2-3 săptămâni)

1. Snapshots + undo/rollback pe sesiuni.
2. Dicționar custom + corecție diacritice îmbunătățită.
3. Căutare/înlocuire globală.
4. Performanță pe documente lungi.

### Faza 3 — Hardening și distribuție (1-2 săptămâni)

1. Installer desktop (macOS/Windows).
2. Backup/restore proiecte.
3. Crash recovery.
4. Telemetrie locală tehnică (opt-in).

## 12. Plan de testare

1. Teste unitare:
   - post-procesare text RO,
   - mapare chunk-uri în document,
   - export DOCX.
2. Teste integrare:
   - flux complet sesiune dictare -> salvare -> reluare -> export.
3. Teste de acceptanță:
   - proiect de 30+ pagini,
   - 10+ sesiuni distincte,
   - verificare diacritice pe termeni frecvenți.
4. Teste reziliență:
   - schimbare dispozitiv audio în timpul dictării,
   - aplicație închisă forțat, reluare fără pierderi.

## 13. Riscuri și mitigări

1. **Acuratețe insuficientă STT pe RO tehnic**
   - mitigare: benchmark inițial + dicționare custom + post-procesare.
2. **Latență mare pe laptopuri mai slabe**
   - mitigare: alegere model mai mic + chunking optim + pipeline async + UI feedback clar.
3. **Documente foarte mari devin lente**
   - mitigare: block-based editor + virtualizare + snapshot incremental.
4. **Consum mare de resurse locale (CPU/RAM)**
   - mitigare: profiluri de performanță (Eco/Balanced/Quality) + throttling controlat.

## 14. Definiție de succes (KPIs)

1. WER/CER acceptabil pe română în scenarii reale.
2. Rată corectitudine diacritice > 95% pe seturi de validare interne.
3. Fără pierdere de conținut la sesiuni lungi.
4. Export DOCX stabil pentru documente de 30-100 pagini.
5. Timp redus de redactare vs. tastare manuală (obiectiv: minim 30% mai rapid).

## 15. Livrabile tehnice inițiale

1. Repo cu structură modulară (desktop app + core services).
2. Schema DB v1 + migrații.
3. MVP dictare incrementală RO.
4. Export DOCX v1.
5. Documentație de operare locală și backup.

---

## Recomandare de start imediat

Primul pas practic este **Faza 0 (benchmark local STT pe mostre reale)**, deoarece alegerea motorului on-device determină acuratețea diacriticelor, viteza și cerințele hardware pe laptop.
