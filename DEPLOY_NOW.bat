@echo off
echo ========================================
echo DEPLOYING FIX TO VERCEL
echo ========================================
echo.
echo This will commit and push all changes to GitHub
echo Vercel will automatically redeploy
echo.
pause

cd "C:\Users\.User\Desktop\Classified\My library  2\Thrift Shop"

echo.
echo [1/4] Staging all changes...
git add .

echo.
echo [2/4] Committing changes...
git commit -m "Fix: Enable API deployment and add debug logging"

echo.
echo [3/4] Pushing to GitHub...
git push

echo.
echo [4/4] Done!
echo.
echo ========================================
echo NEXT STEPS:
echo ========================================
echo 1. Go to https://vercel.com/dashboard
echo 2. Wait for deployment to complete (1-3 min)
echo 3. Check the timestamp in Vercel logs to confirm new deployment
echo 4. Try the forgot password flow again
echo 5. If still failing, check Vercel Function Logs for the debug output
echo.
echo The console logs will show:
echo   - 🔍 API Route Hit
echo   - 📍 Method
echo   - 🔑 Has RESEND_API_KEY
echo   - 📅 Deployed at (timestamp)
echo.
pause
