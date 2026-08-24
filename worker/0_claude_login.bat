@echo off
cd /d "%~dp0"
echo Opening browser to sign in with your Claude subscription...
claude auth login --claudeai
pause
