@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "npm_config_cache=%LOCALAPPDATA%\npm-cache"
echo.
echo === OmniRoute Edge local PC start ===
echo Root: %CD%
if not exist .env (
  echo.
  echo === Creating safe local .env from .env.example ===
  copy /Y .env.example .env >nul
  if errorlevel 1 exit /b %errorlevel%
)
if not exist node_modules (
  echo.
  echo === Installing locked Windows dependencies ===
  if not exist "%npm_config_cache%" mkdir "%npm_config_cache%"
  call npm cache verify
  if errorlevel 1 exit /b %errorlevel%
  call npm ci
  if errorlevel 1 exit /b %errorlevel%
)
echo.
echo === Verifying both local databases ===
call npm run verify:data
if errorlevel 1 exit /b %errorlevel%
echo.
echo === Building current UI ===
call npm run build
if errorlevel 1 exit /b %errorlevel%
echo.
echo === Starting local server ===
call npm run dev:server
