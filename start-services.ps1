Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting Collaborative IDE in 3 Dedicated Windows" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# 1. Yjs Collaboration Server
Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Nexathon [1/3] Yjs WebSocket (Port 1234)'; npm run server:yjs"

# 2. API & Collaborative Terminal Server
Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Nexathon [2/3] API & Terminal Server (Port 3001)'; npm run server:api"

# 3. Vite Frontend Dev Server
Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'Nexathon [3/3] Vite Frontend (Port 5173)'; npm run dev"

Write-Host ""
Write-Host "All 3 services successfully launched in dedicated windows!" -ForegroundColor Green
Write-Host "Frontend URL: " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
