@echo off
echo 🚀 Starting Thrift Shop System for External Access
echo.

echo 📦 Starting Backend Server...
start "Backend" cmd /k "$env:PORT=5001; node server/index.js"

echo ⏳ Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo 🌐 Starting Frontend Server...
start "Frontend" cmd /k "cd client && $env:PORT=3001 && npm start"

echo ⏳ Waiting for frontend to start...
timeout /t 10 /nobreak > nul

echo 🔗 Creating External Tunnels...
echo.
echo 📱 For External Access, use these URLs:
echo.
echo 🏠 Local Access: http://localhost:3001
echo 🔑 Login: admin / admin123
echo.
echo 🌐 External Access Options:
echo 1. Use ngrok: ngrok http 3001
echo 2. Deploy to Vercel: vercel --prod
echo 3. Use screen sharing for demo
echo.
echo ✅ System is running! Check the opened windows.
pause
