$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[QA][Windows] 1/4 Install deps"
npm install

Write-Host "[QA][Windows] 2/4 Static checks"
npm run check

Write-Host "[QA][Windows] 3/4 Automated tests"
npm run test

Write-Host "[QA][Windows] 4/4 Build NSIS installer"
npm run build:win

Write-Host "[QA][Windows] Done. Artefacts in: $root\\dist"
