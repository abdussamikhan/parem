@echo off
setlocal

echo ==================================================
echo Parem Application ^& Docker Toggle
echo ==================================================
echo.

:: Check if the postgres container is running to determine current state
docker ps --format "{{.Names}}" | findstr /i "parem-postgres-1" >nul
if %errorlevel%==0 (
    echo Detected running services. Initiating STOP sequence...
    echo.
    goto :down
) else (
    echo Detected stopped services. Initiating START sequence...
    echo.
    goto :up
)

:up
echo [1/3] Starting Docker Containers (PostgreSQL, n8n, Ollama)...
docker-compose up -d

echo.
echo [2/3] Waiting a few seconds for database to initialize...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting Next.js Application...
start "Parem Frontend Dashboard" cmd /c "npm run dev"

echo.
echo ==================================================
echo System successfully started!
echo - Dashboard: http://localhost:3000 (or 3001)
echo - n8n Automations: http://localhost:5678
echo.
echo Close this window to finish. The application will continue running in its own window.
echo ==================================================
pause
goto :EOF

:down
echo [1/2] Stopping Docker Containers (PostgreSQL, n8n, Ollama)...
docker-compose down --remove-orphans

echo.
echo [2/2] Stopping Next.js Application...
taskkill /FI "WindowTitle eq Parem Frontend Dashboard*" /T /F >nul 2>&1

echo.
echo ==================================================
echo System successfully shut down!
echo ==================================================
pause
goto :EOF
