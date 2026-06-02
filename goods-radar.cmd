@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0goods-radar.ps1" %*
exit /b %ERRORLEVEL%
