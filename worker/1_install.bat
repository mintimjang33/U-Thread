@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
echo.
echo Done. Now run 2_setup.bat
pause
