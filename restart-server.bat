@echo off
title SAGA Server Restart

echo [SAGA] Killing existing processes...
taskkill /F /IM node.exe > nul 2>&1
taskkill /F /IM tsx.exe > nul 2>&1
timeout /t 2 > nul

echo [SAGA] Restarting server...
cd /d "%~dp0"
start "SAGA Server" cmd /k "npm run dev"

echo.
echo [SAGA] Server started in a new window.
echo  - Next.js  : http://localhost:3000
echo  - Socket   : http://localhost:3001
timeout /t 3 > nul
