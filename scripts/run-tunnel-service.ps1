# Kill any lingering node on port 5000 or cloudflared
Get-Process node, cloudflared -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -notlike "*code*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$rootDir = Resolve-Path "$PSScriptRoot\.."
Write-Host "[GNBVG] Starting Node.js backend on port 5000 in $rootDir..."
$nodeProcess = Start-Process node -ArgumentList "server/index.js" -WorkingDirectory $rootDir -PassThru -WindowStyle Hidden -RedirectStandardOutput "$rootDir\node-server.log" -RedirectStandardError "$rootDir\node-error.log"
Start-Sleep -Seconds 4

$portActive = (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue)
if ($portActive) {
    Write-Host "[GNBVG] Node.js backend confirmed listening on port 5000 (PID: $($nodeProcess.Id))."
} else {
    Write-Host "[GNBVG] Warning: Port 5000 not active yet, waiting 3 more seconds..."
    Start-Sleep -Seconds 3
}

Write-Host "[GNBVG] Launching Cloudflare Tunnel for port 5000..."
& .\cloudflared.exe tunnel --url http://localhost:5000 2>&1 | Tee-Object -FilePath "tunnel.log"
