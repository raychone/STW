# Final QA Runbook

## macOS (local)

1. `npm run qa:mac`
2. Instalezi DMG-ul generat din `dist/`.
3. Deschizi aplicația instalată din `Applications`.
4. Rulezi checklist-ul din `ACCEPTANCE_CHECKLIST.md`.

## Windows (local sau VM)

1. `npm run qa:win`
2. Rulezi installer-ul `.exe` din `dist/`.
3. Deschizi aplicația instalată din Start Menu/Desktop shortcut.
4. Rulezi checklist-ul din `ACCEPTANCE_CHECKLIST.md`.

## Ce trebuie atașat la validarea finală

1. Screenshot pentru `Verificare sistem` cu `Ready dictare reală: DA`.
2. Screenshot cu export DOCX final.
3. Confirmare restore backup funcțional.
4. Confirmare test pe macOS + Windows.
