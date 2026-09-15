@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if "%PORT%"=="" set "PORT=3001"

echo Stopping OmniRoute Edge server on port %PORT% ...
powershell -NoProfile -Command "$ids = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Write-Host 'Stopped.' } else { Write-Host 'No process found listening on that port.' }"

endlocal
pause
