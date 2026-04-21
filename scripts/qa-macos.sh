#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[QA][macOS] 1/4 Install deps"
npm install

echo "[QA][macOS] 2/4 Static checks"
npm run check

echo "[QA][macOS] 3/4 Automated tests"
npm run test

echo "[QA][macOS] 4/4 Build DMG"
npm run build:mac

echo "[QA][macOS] Done. Artefacts in: $ROOT_DIR/dist"
