@echo off
echo Starting Coffee Shop POS System...
echo.

echo Installing dependencies...
call npm run install-all

echo.
echo Starting the application...
echo Backend will run on http://localhost:5000
echo Frontend will run on http://localhost:3000
echo.

start "Backend Server" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo Application started successfully!
echo.
echo Customer Interface: http://localhost:3000
echo Staff Portal: http://localhost:3000/staff/login
echo.
echo Default login credentials:
echo Owner/Admin: admin / admin123
echo Cashier: cashier / cashier123
echo.
pause
