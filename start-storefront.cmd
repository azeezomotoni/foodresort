@echo off
setlocal
pushd "%~dp0"
start "A's Accessories Storefront Server" cmd /k node server.mjs
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
popd
endlocal
