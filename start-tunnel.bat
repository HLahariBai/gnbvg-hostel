@echo off
title GNBVG Hostel - Cloudflare HTTPS Tunnel
color 0A
cls
echo =====================================================================
echo    GNBVG HOSTEL (GPREC KURNOOL) - SECURE HTTPS MOBILE TUNNEL
echo =====================================================================
echo.
echo [1/3] Checking for cloudflared executable...

where cloudflared >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] cloudflared is installed in system PATH!
    set CLOUDFLARED_BIN=cloudflared
    goto START_TUNNEL
)

if exist "%~dp0cloudflared.exe" (
    echo [OK] Found portable cloudflared.exe in project directory!
    set CLOUDFLARED_BIN="%~dp0cloudflared.exe"
    goto START_TUNNEL
)

echo [INFO] cloudflared not found locally. Downloading official binary from Cloudflare...
curl.exe -V >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Using Windows curl to download cloudflared-windows-amd64.exe...
    curl.exe -L -o "%~dp0cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
) else (
    echo [INFO] Using PowerShell to download cloudflared-windows-amd64.exe...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe', '%~dp0cloudflared.exe')"
)

if not exist "%~dp0cloudflared.exe" (
    echo [ERROR] Failed to auto-download cloudflared.exe.
    echo Please install via PowerShell: winget install --id Cloudflare.cloudflared
    pause
    exit /b 1
)

set CLOUDFLARED_BIN="%~dp0cloudflared.exe"
echo [OK] Download completed successfully!

:START_TUNNEL
echo.
echo =====================================================================
echo [2/3] Verifying Local Server on port 5000...
echo =====================================================================
echo Make sure your local server is running! (Run 'npm start' in another window)
echo.
echo =====================================================================
echo [3/3] Starting Cloudflare HTTPS Tunnel -> http://localhost:5000
echo =====================================================================
echo LOOK FOR THE GENERATED LINK BELOW:
echo It will look like: https://[random-subdomain].trycloudflare.com
echo Copy and share that HTTPS link with students on their phones!
echo =====================================================================
echo.

%CLOUDFLARED_BIN% tunnel --url http://localhost:5000
pause
