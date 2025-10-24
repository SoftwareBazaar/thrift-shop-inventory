@echo off
echo 🔐 PostgreSQL Password Reset Script
echo ====================================
echo.

echo Step 1: Stopping PostgreSQL service...
net stop postgresql-x64-18
if %errorlevel% neq 0 (
    echo ❌ Failed to stop PostgreSQL service
    echo Please run this script as Administrator
    pause
    exit /b 1
)

echo ✅ PostgreSQL service stopped
echo.

echo Step 2: Starting PostgreSQL in single-user mode...
echo This will open a PostgreSQL prompt. Type the following commands:
echo.
echo ALTER USER postgres PASSWORD 'password123';
echo \q
echo.
echo Press any key to continue...
pause

cd "C:\Program Files\PostgreSQL\18\bin"
postgres.exe --single -D "C:\Program Files\PostgreSQL\18\data" postgres

echo.
echo Step 3: Restarting PostgreSQL service...
net start postgresql-x64-18
if %errorlevel% neq 0 (
    echo ❌ Failed to start PostgreSQL service
    pause
    exit /b 1
)

echo ✅ PostgreSQL service restarted
echo.

echo Step 4: Testing connection...
psql -U postgres -c "SELECT version();" -W
echo.

echo 🎉 Password reset complete!
echo 📝 New password: password123
echo 📝 Update your .env file with: DB_PASSWORD=password123
echo.

echo Press any key to continue...
pause
