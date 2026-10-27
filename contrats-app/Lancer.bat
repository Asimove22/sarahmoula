@echo off
chcp 65001 >nul
title Gestion contractuelle
cd /d "%~dp0"

rem Lance depuis un ZIP non decompresse : seuls les .bat sont extraits dans un dossier temporaire.
if not exist package.json (
  echo.
  echo  Fichiers de l'application introuvables.
  echo  Vous avez probablement lance ce fichier depuis le ZIP sans le decompresser.
  echo  Clic droit sur le ZIP, "Extraire tout...", puis lancez Lancer.bat
  echo  depuis le dossier contrats-app extrait.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js n'est pas installe.
  echo  Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  echo.
  start "" https://nodejs.org/fr/download
  pause
  exit /b 1
)

rem Verifie les composants a chaque lancement : indispensable apres une mise a jour.
echo Verification des composants (la premiere fois : 1 a 2 minutes)...
call npm install --no-audit --no-fund --prefer-offline --loglevel=error
if errorlevel 1 ( pause & exit /b 1 )

echo Preparation de l'interface...
call npm run build --silent
if errorlevel 1 ( pause & exit /b 1 )

set OPEN_BROWSER=1
node --disable-warning=ExperimentalWarning server/index.js
pause
