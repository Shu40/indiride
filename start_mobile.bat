@echo off
echo ===================================================
echo Starting Ride-Hailing Mobile App (Expo / Web)...
echo ===================================================
cd /d %~dp0mobile-app
npx expo start --web
pause
