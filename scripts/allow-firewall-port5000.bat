@echo off
title Allow GNBVG Port 5000 in Windows Firewall
echo ====================================================
echo Requesting Administrator permission to open Port 5000...
echo ====================================================
netsh advfirewall firewall add rule name="GNBVG Hostel Port 5000" dir=in action=allow protocol=TCP localport=5000
echo.
echo Firewall rule added successfully!
pause
