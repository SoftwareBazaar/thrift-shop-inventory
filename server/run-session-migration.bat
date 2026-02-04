@echo off
REM Simple batch script to apply session management migration
REM This script uses psql to run the SQL directly

echo ====================================
echo Session Management Migration
echo ====================================
echo.

REM Check if the SQL file exists
if not exist "schema\add-session-management.sql" (
    echo ERROR: Migration file not found!
    echo Please ensure you're running this from the server directory.
    pause
    exit /b 1
)

echo This will add session management to your database:
echo - Creates sessions table
echo - Adds password_version column
echo - Creates triggers for automatic session invalidation
echo.
echo Press Ctrl+C to cancel, or
pause

REM Option 1: Direct SQL execution (if you have psql)
echo.
echo Attempting to connect to database...
echo.

REM You can modify these connection details or use environment variables
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=thrift_shop
set PGUSER=postgres

REM Run the migration
psql -f "schema\add-session-management.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo Migration completed successfully!
    echo ====================================
    echo.
    echo Next steps:
    echo 1. Restart your application
    echo 2. Test password changes on multiple devices
    echo.
) else (
    echo.
    echo ====================================
    echo Migration failed!
    echo ====================================
    echo.
    echo If psql is not installed, you can:
    echo 1. Use Supabase Dashboard SQL Editor
    echo 2. Use pgAdmin or another PostgreSQL client
    echo 3. Copy the SQL from schema\add-session-management.sql
    echo.
)

pause
