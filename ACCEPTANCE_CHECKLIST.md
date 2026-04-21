# Acceptance Checklist - SpeechToWrite Local

## 1. Setup STT real

1. Engine setat pe `whispercpp`.
2. `Testează setup STT` = OK.
3. `Verificare sistem` arată `Ready dictare reală: DA`.

## 2. Dictare incrementală (scenariu real)

1. Creezi proiect nou.
2. Adaugi minim 5 secțiuni.
3. Rulezi minim 15 sesiuni de dictare pe secțiuni diferite.
4. Verifici că textul este adăugat incremental fără pierderi.

## 3. Diacritice și glosar

1. Adaugi 10 termeni în glosar (global + project).
2. Dictezi termeni fără diacritice.
3. Verifici că sunt corectați conform glosarului.

## 4. Backup/Restore

1. Creezi backup.
2. Modifici proiectul semnificativ.
3. Rulezi restore pe backup-ul creat.
4. Verifici că proiectul revine la starea anterioară.

## 5. Export DOCX

1. Export pe proiect de minim 20 pagini.
2. Deschidere DOCX în Word.
3. Verifici structură capitole + conținut complet.

## 6. Performanță

1. Dictare continuă 30+ minute (în etape).
2. Fără crash și fără blocaje majore UI.
3. Salvare și redeschidere proiect fără inconsistențe.

## 7. Cross-platform

1. macOS build + install + test funcțional complet.
2. Windows build + install + test funcțional complet.
3. Microfon, export, backup și restore valide pe ambele OS.

## 8. Criteriu final de acceptanță

Produsul este considerat "gata" când secțiunile 1-7 sunt bifate pe cel puțin un proiect real complet.
