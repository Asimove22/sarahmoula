# Démarrage de l'application sans fenêtre de console (utilisé par l'icône du Bureau).
# -SansFenetre : démarre en arrière-plan sans ouvrir l'application (démarrage avec Windows).
param([switch]$SansFenetre)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$url = 'http://localhost:4580'

function Show-Message($text) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($text, 'Gestion contractuelle') | Out-Null
}

function Open-AppWindow {
  if ($SansFenetre) { return }
  try { Start-Process 'msedge' -ArgumentList "--app=$url" } catch { Start-Process $url }
}

# Déjà démarrée : on ouvre simplement la fenêtre.
try {
  $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2 -UseBasicParsing
  if ($health.app -eq 'contrats-app') { Open-AppWindow; exit 0 }
} catch { }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Show-Message "Node.js n'est pas installé.`nTéléchargez la version LTS sur https://nodejs.org puis relancez."
  Start-Process 'https://nodejs.org/fr/download'
  exit 1
}

# Premier lancement ou mise à jour : installation visible dans une fenêtre classique.
& node scripts\prepare.mjs --check
if ($LASTEXITCODE -ne 0) {
  if ($SansFenetre) { exit 0 }
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$root\Lancer.bat`""
  exit 0
}

New-Item -ItemType Directory -Force -Path "$root\data" | Out-Null
if (-not $SansFenetre) { $env:OPEN_BROWSER = '1' }
Start-Process -FilePath 'node' -ArgumentList '--disable-warning=ExperimentalWarning', 'server\index.js' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput "$root\data\journal-application.log" -RedirectStandardError "$root\data\journal-erreurs.log"
