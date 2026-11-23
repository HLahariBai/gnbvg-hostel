@echo off
title GNBVG Hostel - Complete Server & HTTPS Tunnel Starter
color 0B
cls
echo =====================================================================
echo    GNBVG HOSTEL (GPREC KURNOOL) - COMPLETE ONE-CLICK LAUNCHER
echo =====================================================================
echo.
echo Starting 100%% Local Server (Node.js on Port 5000)...
start "GNBVG Local Backend (Port 5000)" cmd /k "cd /d %~dp0 && npm start"

timeout /t 3 >nul

echo Starting Cloudflare HTTPS Mobile Tunnel...
start "GNBVG HTTPS Tunnel (Mobile 4G/5G Access)" cmd /k "cd /d %~dp0 && start-tunnel.bat"

echo.
echo =====================================================================
echo Both services are launching in separate windows:
echo 1. Local Backend Window:  Runs http://localhost:5000
echo 2. Cloudflare Window:     Outputs your secure https://....trycloudflare.com link
echo.
echo You can now open the HTTPS link on any student mobile phone!
echo =====================================================================
pause
