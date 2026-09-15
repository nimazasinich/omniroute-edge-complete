@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "npm_config_cache=%LOCALAPPDATA%\npm-cache"
if not exist node_modules (
  if not exist "%npm_config_cache%" mkdir "%npm_config_cache%"
  call npm ci
  if errorlevel 1 exit /b %errorlevel%
)
call npm run verify:data
