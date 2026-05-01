@echo off
setlocal

if "%1"=="up" goto up
if "%1"=="down" goto down
goto help

:help
echo.
echo ==================================================
echo AI Patient Care System Control Panel
echo ==================================================
echo.
echo Usage: 
echo   parem.bat up     - Starts database, n8n, Ollama, and Next.js Dashboard
echo   parem.bat down   - Stops all services and closes the dashboard
echo.
goto end

:up
echo [1/3] Starting Backend Services (PostgreSQL, n8n, Ollama)...
docker-compose up -d

echo.
echo [2/3] Waiting a few seconds for database to initialize...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting Care Command Center Dashboard...
:: Starts npm run dev in a new named window
start "Parem Frontend Dashboard" cmd /c "npm run dev"

echo.
echo ==================================================
echo System successfully started!
echo - Dashboard: http://localhost:3000 (or 3001)
echo - n8n Automations: http://localhost:5678
echo ==================================================
goto end

:down
echo [1/2] Stopping Backend Services (PostgreSQL, n8n, Ollama)...
docker-compose down

echo.
echo [2/2] Stopping Care Command Center Dashboard...
:: Kills the window we created earlier
taskkill /FI "WindowTitle eq Parem Frontend Dashboard*" /T /F >nul 2>&1

echo.
echo ==================================================
echo System successfully shut down!
echo ==================================================
goto end

:end
endlocal
