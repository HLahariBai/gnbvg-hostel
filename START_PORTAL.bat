@echo off
title GNBVG Hostel Portal - Launcher
color 0A
cd /d "%~dp0"
cls
echo =====================================================================
echo   GNBVG HOSTEL (GPREC KURNOOL) - ONE-CLICK HTTPS LAUNCHER
echo =====================================================================
echo.
echo [1/3] Closing any old background sessions...
taskkill /f /im node.exe >nul 2>nul
taskkill /f /im cloudflared.exe >nul 2>nul
timeout /t 1 /nobreak >nul

echo [2/3] Starting GNBVG Enterprise Backend on Port 5000...
start /b node server/index.js > node-server.log 2>&1
timeout /t 3 /nobreak >nul

echo [3/3] Generating secure HTTPS Cloudflare Tunnel...
echo =====================================================================
echo COPY THE HTTPS LINK DISPLAYED BELOW (ending in .trycloudflare.com):
echo Add /hostel to the link, for example:
echo https://random-name.trycloudflare.com/hostel
echo =====================================================================
echo.
.\cloudflared.exe tunnel --url http://localhost:5000
pause
