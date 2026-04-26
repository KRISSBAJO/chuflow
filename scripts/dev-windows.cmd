@echo off
setlocal

cd /d "%~dp0\.."

echo Launching API and Web in separate terminals...
start "Church API" cmd /k "cd /d %CD% && npm run dev:api"
start "Church Web" cmd /k "cd /d %CD% && npm run dev:web"

echo Both development servers are starting.
echo API docs: http://localhost:4000/docs
echo Web app:  http://localhost:3001
