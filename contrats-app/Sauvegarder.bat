@echo off
chcp 65001 >nul
title Sauvegarde - Gestion contractuelle
cd /d "%~dp0"

rem Lance depuis un ZIP non decompresse : seuls les .bat sont extraits dans un dossier temporaire.
if not exist package.json (
  echo.
  echo  Fichiers de l'application introuvables.
  echo  Vous avez probablement lance ce fichier depuis le ZIP sans le decompresser.
  echo  Clic droit sur le ZIP, "Extraire tout...", puis lancez Sauvegarder.bat
  echo  depuis le dossier contrats-app extrait.
  echo.
  pause
  exit /b 1
)

if not exist data (
  echo Aucune donnee a sauvegarder pour le moment.
  pause
  exit /b 0
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set STAMP=%%i
if not exist sauvegardes mkdir sauvegardes

echo Sauvegarde de la base et de tous les documents...
tar -a -c -f "sauvegardes\sauvegarde-%STAMP%.zip" data
if errorlevel 1 (
  echo La sauvegarde a echoue.
  pause
  exit /b 1
)

echo.
echo  Sauvegarde creee : sauvegardes\sauvegarde-%STAMP%.zip
echo  Copiez ce fichier sur une cle USB ou un disque externe.
echo.
pause
