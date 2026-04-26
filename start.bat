@echo off
cd /d "%~dp0"
start "" powershell -NoProfile -WindowStyle Hidden -Command "Set-Location '%~dp0'; node server.js"
timeout /t 2 >nul
start "" http://127.0.0.1:3210
