@echo off
title SAGA Server

echo [SAGA] Killing existing processes...
taskkill /F /IM node.exe > nul 2>&1
taskkill /F /IM tsx.exe > nul 2>&1
timeout /t 2 > nul

echo [SAGA] Starting server...
echo  - Next.js  : http://localhost:3000
echo  - Socket   : http://localhost:3001
echo.
echo Press Ctrl+C or close this window to stop.
echo.

cd /d "%~dp0"
npm run dev
