@echo off
chcp 65001 >nul
title Installation de l'icone - Gestion contractuelle
cd /d "%~dp0"

if not exist package.json (
  echo.
  echo  Decompressez d'abord le ZIP ^(clic droit, "Extraire tout..."^), puis lancez
  echo  Installer-raccourci.bat depuis le dossier contrats-app extrait.
  echo.
  pause
  exit /b 1
)

echo.
echo  Creation de l'icone "Gestion contractuelle" sur le Bureau et dans le menu Demarrer.
echo.
set AUTO=N
set /p AUTO=" Demarrer automatiquement l'application a l'ouverture de session Windows ? (O/N) : "

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer-raccourci.ps1" -Auto "%AUTO%"
if errorlevel 1 (
  echo.
  echo  La creation de l'icone a echoue.
  pause
  exit /b 1
)

echo.
echo  Icone creee. Double-cliquez sur "Gestion contractuelle" sur le Bureau.
echo  Astuce : clic droit sur l'icone, "Epingler a la barre des taches".
echo.
pause
