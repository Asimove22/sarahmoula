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

# Toute erreur inattendue est affichée au lieu de disparaître silencieusement (l'icône n'a pas de console).
trap {
  Show-Message "Clausia n'a pas pu démarrer :`n$($_.Exception.Message)`n`nLancez Lancer.bat dans le dossier $root pour voir le détail."
  exit 1
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

# node:sqlite exige Node.js 22.13 ou plus récent.
$nodeVersion = (& node -v) -replace '^v', ''
if ([version]$nodeVersion -lt [version]'22.13.0') {
  Show-Message "Node.js $nodeVersion est trop ancien (22.13 minimum).`nInstallez la version LTS sur https://nodejs.org puis relancez."
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
$errLog = "$root\data\journal-erreurs.log"
$server = Start-Process -FilePath 'node' -ArgumentList '--disable-warning=ExperimentalWarning', 'server\index.js' `
  -WorkingDirectory $root -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput "$root\data\journal-application.log" -RedirectStandardError $errLog

# On vérifie que le serveur répond ; sinon on explique pourquoi au lieu de ne rien afficher.
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2 -UseBasicParsing
    if ($health.app -eq 'contrats-app') { exit 0 }
  } catch { }
  if ($server.HasExited) { break }
}
if ($SansFenetre) { exit 1 }
$detail = ''
if (Test-Path $errLog) { $detail = (Get-Content $errLog -Tail 8 -ErrorAction SilentlyContinue) -join "`n" }
$hint = if ($detail -match 'EADDRINUSE|4580 est d') { "Le port 4580 est occupé par un autre programme (souvent une ancienne copie de Clausia) : redémarrez le PC." } else { "Lancez Lancer.bat dans ce dossier pour voir le détail." }
Show-Message "Clausia n'a pas démarré.`n`n$hint`n`nDossier : $root`n`n$detail"
