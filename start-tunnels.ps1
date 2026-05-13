# ============================================================
# MediRecall - Public Tunnel Startup Script
# ============================================================
# This script starts ngrok tunnels for both the frontend and
# backend, making the app accessible from any phone/network.
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  MediRecall - Starting Public Tunnels (ngrok)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Start backend tunnel (port 8000)
Write-Host "[1/2] Starting backend tunnel (port 8000)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock { npx ngrok http 8000 --log=stdout 2>&1 }
Start-Sleep -Seconds 5

# Step 2: Get backend tunnel URL
Write-Host "[*] Fetching backend tunnel URL..." -ForegroundColor Yellow
try {
    $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
    $backendUrl = ($tunnels.tunnels | Where-Object { $_.config.addr -match "8000" } | Select-Object -First 1).public_url
    if (-not $backendUrl) {
        $backendUrl = $tunnels.tunnels[0].public_url
    }
    Write-Host "[OK] Backend tunnel: $backendUrl" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Could not get backend tunnel URL. Make sure ngrok is running." -ForegroundColor Red
    Write-Host "Try running manually: npx ngrok http 8000" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  SETUP INSTRUCTIONS" -ForegroundColor Cyan  
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Update your frontend .env file with:" -ForegroundColor White
Write-Host "   VITE_API_URL=`"$backendUrl`"" -ForegroundColor Green
Write-Host ""
Write-Host "2. Restart your frontend (npm run dev)" -ForegroundColor White
Write-Host ""
Write-Host "3. Open a NEW terminal and run:" -ForegroundColor White
Write-Host "   npx ngrok http 8080" -ForegroundColor Green
Write-Host ""
Write-Host "4. Copy the frontend ngrok URL and add to .env:" -ForegroundColor White
Write-Host "   VITE_PUBLIC_URL=`"<your-frontend-ngrok-url>`"" -ForegroundColor Green
Write-Host ""
Write-Host "5. Restart frontend again, then scan the QR!" -ForegroundColor White
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Backend tunnel is running. Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Keep the script running
Wait-Job $backendJob
Receive-Job $backendJob
