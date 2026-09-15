@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === OmniRoute Edge - Launch UI ===
echo Root: %CD%

if not exist .env (
  echo.
  echo === Creating local .env from .env.example ===
  copy /Y .env.example .env >nul
  if errorlevel 1 (
    echo Failed to create .env
    pause
    exit /b 1
  )
)

if not exist node_modules (
  echo.
  echo === Installing dependencies (first run only) ===
  call npm ci
  if errorlevel 1 (
    echo npm ci failed
    pause
    exit /b 1
  )
)

if not exist dist (
  echo.
  echo === Building UI ===
  call npm run build
  if errorlevel 1 (
    echo Build failed
    pause
    exit /b 1
  )
)

if "%PORT%"=="" set "PORT=3001"

echo.
echo === Starting server + UI in background (no console window) ===
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev:server' -WorkingDirectory '%CD%' -WindowStyle Hidden"

echo Waiting for server to come up...
timeout /t 4 /nobreak >nul

start "" "http://127.0.0.1:%PORT%/"

if not exist "%USERPROFILE%\Desktop\OmniRoute Edge.lnk" (
  echo.
  echo === Creating desktop shortcut ===
  powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\OmniRoute Edge.lnk'); $s.TargetPath='%CD%\LAUNCH-UI.cmd'; $s.WorkingDirectory='%CD%'; $s.IconLocation='shell32.dll,13'; $s.WindowStyle=7; $s.Description='Launch OmniRoute Edge (server + UI)'; $s.Save()"
)

echo.
echo === OmniRoute Edge is running in the background ===
echo UI:      http://127.0.0.1:%PORT%/
echo To stop: run STOP-UI.cmd
echo.
endlocal
