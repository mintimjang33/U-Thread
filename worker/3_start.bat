@echo off
cd /d "%~dp0"
echo Starting U-Thread local worker. Closing this window stops it.
node index.js
pause
