@echo off
cd /d "%~dp0..\"
echo ========================================
echo   FaceRacer Local Test Server
echo ========================================
echo.
echo Starting server on http://localhost:8000
echo Press Ctrl+C to stop
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python HTTP server...
    echo Opening browser...
    start http://localhost:8000/game.html
    python -m http.server 8000
    goto :end
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Node.js http-server...
    REM Install http-server if not installed
    npx http-server -p 8000 -o game.html
    goto :end
)

echo Error: Neither Python nor Node.js found!
echo Please install Python or Node.js to run the local server.
pause

:end
