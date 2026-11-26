@echo off
echo ===================================================
echo Starting Production Ride-Hailing FastAPI Backend...
echo ===================================================
cd /d %~dp0backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
pause
