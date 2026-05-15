@echo off
title SAGA Server Stop

echo [SAGA] Stopping server...
echo.
taskkill /F /IM node.exe > nul 2>&1
taskkill /F /IM tsx.exe > nul 2>&1
echo  [Done] All processes terminated.
echo.
echo [SAGA] Server stopped.
timeout /t 2 > nul
