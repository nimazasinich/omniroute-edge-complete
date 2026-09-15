@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OmniRoute Edge - Sanitized Cloudflare Deploy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-current-source.ps1"
if errorlevel 1 goto :fail
exit /b 0
:fail
echo.
echo DEPLOY STOPPED. No PASS was claimed for a failed or blocked gate.
exit /b 1
