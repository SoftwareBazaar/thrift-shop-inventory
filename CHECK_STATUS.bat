@echo off
echo ========================================
echo CHECKING DEPLOYMENT STATUS
echo ========================================
echo.

cd "C:\Users\.User\Desktop\Classified\My library  2\Thrift Shop"

echo [1] Checking what's NOT committed:
echo -----------------------------------
git status --short
echo.

echo [2] Checking if .vercelignore was committed:
echo -----------------------------------
git log --all --full-history -1 --oneline -- .vercelignore
echo.

echo [3] Showing current .vercelignore content:
echo -----------------------------------
type .vercelignore
echo.

echo [4] Checking if 'api/' line exists in .vercelignore:
echo -----------------------------------
findstr /C:"api/" .vercelignore
if %ERRORLEVEL% EQU 0 (
    echo ❌ PROBLEM: Found 'api/' in .vercelignore
) else (
    echo ✅ GOOD: 'api/' NOT found in .vercelignore
)
echo.

echo ========================================
echo ACTION REQUIRED:
echo ========================================
echo If git status shows .vercelignore as modified:
echo   1. git add .vercelignore
echo   2. git commit -m "Remove api/ from .vercelignore"  
echo   3. git push
echo.
echo If it shows nothing, the issue might be:
echo   - Vercel configuration (check vercel.json)
echo   - Vercel Authentication enabled
echo   - Deployment hasn't completed yet
echo.
pause
