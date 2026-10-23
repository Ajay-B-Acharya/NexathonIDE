@echo off
title NexathonIDE Launcher
echo ===================================================
echo Starting Collaborative IDE in 3 Dedicated Windows
echo ===================================================

start "Nexathon - 1. Yjs Server (Port 1234)" cmd /k "npm run server:yjs"
start "Nexathon - 2. API & Terminal Server (Port 3001)" cmd /k "npm run server:api"
start "Nexathon - 3. Vite Frontend (Port 5173)" cmd /k "npm run dev"

echo.
echo All 3 service windows have been opened!
echo Frontend will be accessible at: http://localhost:5173
echo.
