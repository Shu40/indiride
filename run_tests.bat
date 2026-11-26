@echo off
echo ===================================================
echo 1. Running Backend Unit and Integration Tests (pytest)
echo ===================================================
cd /d %~dp0backend
python -m pytest tests -v
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend tests failed!
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo 2. Type-Checking Mobile TypeScript App (tsc)
echo ===================================================
cd /d %~dp0mobile-app
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Mobile TypeScript type-checking failed!
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo ALL SYSTEM TESTS AND COMPILES PASSED SUCCESSFULLY!
echo ===================================================
pause
