@echo off
echo 🚀 Starting Thrift Shop Inventory Management System
echo ================================================
echo.

echo Step 1: Killing any existing Node.js processes...
taskkill /F /IM node.exe 2>nul
echo ✅ Cleaned up existing processes
echo.

echo Step 2: Starting Backend Server...
start "Backend Server" cmd /k "node server/index.js"
timeout /t 3 /nobreak >nul
echo ✅ Backend server started on port 5000
echo.

echo Step 3: Starting Frontend Server...
start "Frontend Server" cmd /k "cd client && npm start"
timeout /t 5 /nobreak >nul
echo ✅ Frontend server starting on port 3000
echo.

echo 🎉 System is starting up!
echo.
echo 📱 Access the application at: http://localhost:3000
echo 🔑 Login credentials: admin / admin123
echo.
echo ⚠️  Keep this window open to monitor the system
echo ⚠️  Close the individual server windows to stop the system
echo.
pause
