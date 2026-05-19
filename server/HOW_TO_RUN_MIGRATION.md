# How to Run the Session Management Migration

## You have 3 options:

### Option 1: Use Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file: `C:\Users\.User\Desktop\Classified\My library  2\Thrift Shop\server\schema\add-session-management.sql`
5. Copy ALL the SQL content
6. Paste it into the Supabase SQL Editor
7. Click **Run** button
8. Check for success message

### Option 2: Use pgAdmin (If you have it installed)

1. Open pgAdmin
2. Connect to your database
3. Right-click on your database → **Query Tool**
4. Open file: `server\schema\add-session-management.sql`
5. Click **Execute** (F5)

### Option 3: Manual SQL Execution

If you're connected to a local PostgreSQL database, run this in PowerShell:

```powershell
cd "C:\Users\.User\Desktop\Classified\My library  2\Thrift Shop\server"

# Replace these with your actual database credentials
$env:PGPASSWORD="your-password"
psql -h localhost -U postgres -d thrift_shop -f "schema\add-session-management.sql"
```

## What to Do After Migration

1. **Restart your application** (both server and client)
2. **Test the fix:**
   - Login on 2 different browsers
   - Change password on one
   - Verify both log out
   - Old password should be rejected
   - New password should work

## If You Get Errors

**"column already exists"** - The migration was already run, you're good!

**"table already exists"** - The migration was already run, you're good!

**"permission denied"** - You need admin/superuser privileges on the database

## Verify It Worked

Run this SQL to check:

```sql
-- Check if sessions table exists
SELECT * FROM sessions LIMIT 1;

-- Check if password_version column exists
SELECT user_id, username, password_version FROM users LIMIT 1;
```

If both queries work without errors, the migration was successful! ✅
