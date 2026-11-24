@echo off
rem Double-click to start the Expense Tracker.
rem The first run creates the venv folder and installs Flask (needs internet once).

cd /d "%~dp0"

if not exist "venv\Scripts\activate.bat" (
  echo First run: setting things up, this takes a minute...
  python -m venv venv
  if errorlevel 1 (
    echo Could not run Python. Install Python from python.org and tick "Add Python to PATH".
    pause
    exit /b 1
  )
  call "venv\Scripts\activate.bat"
  pip install -r requirements.txt
  if errorlevel 1 (
    echo Install failed. Check your internet connection and run this file again.
    pause
    exit /b 1
  )
) else (
  call "venv\Scripts\activate.bat"
)

echo.
echo Starting the Expense Tracker...
echo Open http://127.0.0.1:5000 in your browser if it does not open by itself.
echo Press Ctrl+C in this window to stop the server.
echo.

rem Open the browser after a short delay
start "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://127.0.0.1:5000"

python app.py

pause
