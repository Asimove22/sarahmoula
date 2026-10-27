# Crée l'icône « Gestion contractuelle » sur le Bureau, dans le menu Démarrer et, si demandé, au démarrage de Windows.
param([string]$Auto = 'N')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Fichiers issus d'un ZIP téléchargé : on lève le blocage de sécurité Windows.
Get-ChildItem -Path $root -Filter *.ps1 -Recurse -Depth 1 | Unblock-File -ErrorAction SilentlyContinue
Get-ChildItem -Path $root -Filter *.bat | Unblock-File -ErrorAction SilentlyContinue

$shell = New-Object -ComObject WScript.Shell
$powershell = (Get-Command powershell.exe).Source

function New-AppShortcut([string]$Path, [string]$Extra) {
  $link = $shell.CreateShortcut($Path)
  $link.TargetPath = $powershell
  $link.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $root + '\Demarrer.ps1" ' + $Extra
  $link.WorkingDirectory = $root
  $link.IconLocation = "$root\public\app.ico,0"
  $link.WindowStyle = 7
  $link.Description = 'Gestion contractuelle et documentaire'
  $link.Save()
  Write-Host "  Créé : $Path"
}

New-AppShortcut ([Environment]::GetFolderPath('Desktop') + '\Gestion contractuelle.lnk') ''
New-AppShortcut ([Environment]::GetFolderPath('Programs') + '\Gestion contractuelle.lnk') ''

$startup = [Environment]::GetFolderPath('Startup') + '\Gestion contractuelle.lnk'
if ($Auto -match '^[oOyY]') {
  New-AppShortcut $startup '-SansFenetre'
} elseif (Test-Path $startup) {
  Remove-Item $startup
  Write-Host '  Démarrage automatique désactivé.'
}
