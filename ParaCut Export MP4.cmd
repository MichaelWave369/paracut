@echo off
setlocal
title ParaCut Local MP4 Export
echo.
echo  ===============================================
echo   PARACUT - LOCAL MP4 EXPORT COMPANION
echo  ===============================================
echo.
echo  No media uploads. Requires Node.js and FFmpeg.
echo.
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0tools\windows-export.ps1"
set "PARACUT_EXIT=%ERRORLEVEL%"
echo.
if not "%PARACUT_EXIT%"=="0" (
  echo  ParaCut export did not complete. See details above.
) else (
  echo  ParaCut local export launcher finished.
)
echo.
pause
exit /b %PARACUT_EXIT%
