@echo off
chcp 65001 >nul
title Diagnostic Clausia
cd /d "%~dp0"

rem Rapport de diagnostic : verifie chaque condition de demarrage et ecrit le resultat
rem sur le Bureau (diagnostic-clausia.txt), puis l'ouvre dans le Bloc-notes.
set "OUT=%USERPROFILE%\Desktop\diagnostic-clausia.txt"
if not exist "%USERPROFILE%\Desktop" set "OUT=%~dp0diagnostic-clausia.txt"

echo.
echo  Diagnostic en cours (30 secondes environ)...
echo.

> "%OUT%" echo ==== DIAGNOSTIC CLAUSIA - %DATE% %TIME% ====
>>"%OUT%" echo.
>>"%OUT%" echo [1] Dossier de l'application
>>"%OUT%" echo     %~dp0
echo %~dp0 | findstr /i "OneDrive Dropbox" >nul && >>"%OUT%" echo     ATTENTION : dossier synchronise OneDrive/Dropbox, a deplacer (ex. C:\Clausia)
if exist package.json (>>"%OUT%" echo     OK package.json present) else (>>"%OUT%" echo     ERREUR package.json absent : mauvais dossier ou ZIP non decompresse)
if exist server\index.js (>>"%OUT%" echo     OK server\index.js present) else (>>"%OUT%" echo     ERREUR server\index.js absent)

>>"%OUT%" echo.
>>"%OUT%" echo [2] Node.js (22.13 minimum)
where node >nul 2>nul
if errorlevel 1 (
  >>"%OUT%" echo     ERREUR Node.js introuvable : installer la version LTS sur https://nodejs.org
) else (
  for /f "delims=" %%v in ('node -v') do >>"%OUT%" echo     version %%v
  node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" && (>>"%OUT%" echo     OK version suffisante) || (>>"%OUT%" echo     ERREUR version trop ancienne : installer la LTS sur https://nodejs.org)
  node -e "require('node:sqlite')" 2>nul && (>>"%OUT%" echo     OK module sqlite disponible) || (>>"%OUT%" echo     ERREUR module node:sqlite indisponible)
)

>>"%OUT%" echo.
>>"%OUT%" echo [3] Composants installes
if exist node_modules (>>"%OUT%" echo     OK node_modules present) else (>>"%OUT%" echo     A FAIRE node_modules absent : lancer Lancer.bat une premiere fois avec Internet)
if exist dist\index.html (>>"%OUT%" echo     OK interface construite) else (>>"%OUT%" echo     A FAIRE interface non construite : lancer Lancer.bat)

>>"%OUT%" echo.
>>"%OUT%" echo [4] Donnees
if exist data\contrats.db (>>"%OUT%" echo     OK data\contrats.db present) else (>>"%OUT%" echo     INFO pas de base : premier lancement, ou dossier data non recopie)
if exist data\files (>>"%OUT%" echo     OK data\files present) else (>>"%OUT%" echo     INFO pas de dossier data\files)
where node >nul 2>nul && if exist node_modules (
  node --disable-warning=ExperimentalWarning --input-type=module -e "import('./server/db.js').then((m)=>{const db=m.openDatabase('data');console.log('    OK base ouverte, '+db.prepare('SELECT COUNT(*) AS n FROM contracts').get().n+' contrat(s)');db.close();}).catch((e)=>{console.log('    ERREUR base : '+e.message);process.exit(1);})" >>"%OUT%" 2>&1
)

>>"%OUT%" echo.
>>"%OUT%" echo [5] Port 4580 (Clausia)
netstat -ano | findstr /r /c:":4580 .*LISTENING" >nul
if errorlevel 1 (
  >>"%OUT%" echo     libre : Clausia ne tourne pas actuellement
) else (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":4580 .*LISTENING"') do (
    >>"%OUT%" echo     occupe par le processus %%p :
    tasklist /fi "PID eq %%p" /fo list | findstr /i "Nom Image" >>"%OUT%"
  )
  curl.exe -s -m 3 http://localhost:4580/api/health >>"%OUT%" 2>&1
  >>"%OUT%" echo.
)

>>"%OUT%" echo.
>>"%OUT%" echo [6] Ollama (IA locale)
curl.exe -s -m 3 http://localhost:11434/api/tags >"%TEMP%\clausia-ollama.txt" 2>nul
if errorlevel 1 (
  >>"%OUT%" echo     Ollama ne repond pas sur le port 11434 : non lance ou non installe
) else (
  >>"%OUT%" echo     Ollama repond. Modeles installes :
  type "%TEMP%\clausia-ollama.txt" >>"%OUT%"
  >>"%OUT%" echo.
)

>>"%OUT%" echo.
>>"%OUT%" echo [7] PowerShell et icone du Bureau
powershell -NoProfile -Command "Write-Output ('    PowerShell ' + $PSVersionTable.PSVersion.ToString()); Get-ExecutionPolicy -List | ForEach-Object { '    ' + $_.Scope + ' : ' + $_.ExecutionPolicy }" >>"%OUT%" 2>&1
if errorlevel 1 >>"%OUT%" echo     ERREUR PowerShell ne s'execute pas (bloque par l'entreprise ?) : utiliser Lancer.bat
powershell -NoProfile -Command "$l = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Clausia.lnk'); if (-not $l.Arguments) { $l = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Gestion contractuelle.lnk') }; if (-not $l.Arguments) { '    pas d''icone Clausia sur le Bureau' } else { $p = $l.Arguments.Split([char]34)[1]; '    icone -> ' + $p; if (Test-Path $p) { '    OK le fichier cible existe' } else { '    ERREUR la cible n''existe plus : relancer Installer-raccourci.bat depuis ce dossier' } }" >>"%OUT%" 2>&1
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "AUTOSTART=non active"
if exist "%STARTUP%\Gestion contractuelle.lnk" set "AUTOSTART=active"
if exist "%STARTUP%\Clausia.lnk" set "AUTOSTART=active"
>>"%OUT%" echo     demarrage automatique : %AUTOSTART%

>>"%OUT%" echo.
>>"%OUT%" echo [8] Edge
where msedge >nul 2>nul && (>>"%OUT%" echo     OK msedge trouve) || (if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (>>"%OUT%" echo     OK Edge installe) else (>>"%OUT%" echo     Edge introuvable : le navigateur par defaut sera utilise))

>>"%OUT%" echo.
>>"%OUT%" echo [9] Dernieres erreurs (data\journal-erreurs.log)
if exist data\journal-erreurs.log (
  powershell -NoProfile -Command "Get-Content -Encoding UTF8 'data\journal-erreurs.log' -Tail 25" >>"%OUT%" 2>nul || type data\journal-erreurs.log >>"%OUT%"
) else (
  >>"%OUT%" echo     aucun journal d'erreurs
)

>>"%OUT%" echo.
>>"%OUT%" echo [10] Essai de demarrage (si le port est libre)
netstat -ano | findstr /r /c:":4580 .*LISTENING" >nul
if errorlevel 1 if exist node_modules (
  start "" /b cmd /c "set PORT=4599&& node --disable-warning=ExperimentalWarning server\index.js > "%TEMP%\clausia-essai.txt" 2>&1"
  timeout /t 12 /nobreak >nul
  curl.exe -s -m 3 http://localhost:4599/api/health >"%TEMP%\clausia-health.txt" 2>nul && (>>"%OUT%" echo     OK le serveur demarre correctement) || (>>"%OUT%" echo     ERREUR le serveur ne repond pas apres 12 s)
  >>"%OUT%" echo     --- sortie du serveur ---
  type "%TEMP%\clausia-essai.txt" >>"%OUT%"
  curl.exe -s -m 3 -X POST http://localhost:4599/api/system/shutdown >nul 2>nul
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":4599 .*LISTENING"') do taskkill /pid %%p /f >nul 2>nul
)

>>"%OUT%" echo.
>>"%OUT%" echo ==== FIN DU DIAGNOSTIC ====

echo  Rapport enregistre : %OUT%
echo  Envoyez une capture ou le contenu de ce fichier.
start "" notepad "%OUT%"
echo.
pause
