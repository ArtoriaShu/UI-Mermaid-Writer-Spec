@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 deepseek_bridge.py
) else (
  python deepseek_bridge.py
)
if not %errorlevel%==0 (
  echo.
  echo Failed to start the local DeepSeek bridge. Make sure Python 3 is installed.
  pause
)
endlocal
