@echo off
echo ============================================
echo   Creating Distribution Package
echo ============================================
echo.

REM Build the app first
call build-for-production.bat

echo.
echo Creating ZIP package...

cd client\build

REM Create directory for package
if not exist ..\..\dist-package (
    mkdir ..\..\dist-package
)

REM Copy files to package directory
xcopy /E /I /Y * ..\..\dist-package\

cd ..\..

REM Create README for package
echo Creating instructions file...
(
    echo THRIFT SHOP MANAGEMENT SYSTEM
    echo ================================
    echo.
    echo HOW TO USE:
    echo 1. Extract all files from this ZIP
    echo 2. Open index.html in your web browser
    echo 3. Login with the credentials below
    echo.
    echo LOGIN CREDENTIALS:
    echo Username: admin
    echo Password: admin123
    echo.
    echo SYSTEM REQUIREMENTS:
    echo - Any modern web browser
    echo - Works on Windows, Mac, or Linux
    echo - No internet required
    echo.
    echo FEATURES:
    echo - Inventory Management
    echo - Sales Recording
    echo - User Management
    echo - Reports and Analytics
    echo - Credit Sales Tracking
    echo.
    echo ================================
    echo Built: %date% %time%
) > dist-package\START_HERE.txt

echo ✓ Package created in: dist-package\
echo.
echo You can now ZIP the 'dist-package' folder and share it!
echo.
pause

