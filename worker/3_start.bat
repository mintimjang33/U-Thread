@echo off
cd /d "%~dp0"
echo Starting U-Thread local worker (minimized) and opening dashboard...
start "U-Thread Worker" /min cmd /c node index.js
timeout /t 3 /nobreak >nul
start http://localhost:5757
