@echo off
TITLE GNBVG Smart Hostel Attendance - College Server
COLOR 0A
cls
echo ==============================================================
echo       G. NARAYANAMMA BALIKALA VASATHI GRUHAM (GNBVG)
echo           Smart FRS Hostel Attendance System
echo ==============================================================
echo.
echo [1/3] Checking Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Installing dependencies if needed...
if not exist "server\node_modules\" (
    echo Installing server packages...
    call npm --prefix server install --omit=dev
)

echo [3/3] Starting GNBVG Local Server on Port 5000...
echo.
echo Local Access (Warden & Campus LAN): http://localhost:5000/hostel
echo.
echo Starting server...
node server/index.js
pause
