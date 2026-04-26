@echo off
setlocal

cd /d "%~dp0\.."

echo Stopping Node processes...
taskkill /F /IM node.exe >nul 2>&1

echo Cleaning old install artifacts...
if exist node_modules rmdir /S /Q node_modules
if exist apps\web\node_modules rmdir /S /Q apps\web\node_modules
if exist apps\api\node_modules rmdir /S /Q apps\api\node_modules
if exist apps\web\.next rmdir /S /Q apps\web\.next
if exist apps\api\dist rmdir /S /Q apps\api\dist

echo Reinstalling dependencies...
call npm install
if errorlevel 1 exit /b 1

echo Repair complete.
echo.
echo Next:
echo   npm run dev:windows
echo or start manually:
echo   npm run dev:api
echo   npm run dev:web
