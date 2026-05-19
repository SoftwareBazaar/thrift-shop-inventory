@echo off
echo ============================================
echo   Thrift Shop - Production Build Script
echo ============================================
echo.

echo [1/4] Installing dependencies...
cd client
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo [2/4] Building production version...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo ✓ Build completed successfully
echo.

echo [3/4] Preparing distribution files...
cd build
echo ✓ Distribution files ready
echo.

echo [4/4] Creating package information...
cd ..
echo ============================================
echo   BUILD COMPLETE!
echo ============================================
echo.
echo Production files are in: client\build\
echo.
echo NEXT STEPS:
echo 1. Upload client\build\ to Netlify
echo 2. OR share the folder with admin
echo 3. Admin opens index.html in browser
echo.
echo ============================================
pause

