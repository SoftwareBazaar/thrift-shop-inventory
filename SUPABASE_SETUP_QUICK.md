# Supabase Database Setup - Quick Guide

## Run this SQL in Supabase SQL Editor

Copy and paste the entire contents of `server/schema/init.sql` into the Supabase SQL Editor and execute it.

This will create:
- ✅ All database tables (users, stalls, items, sales, etc.)
- ✅ Default admin user (username: `admin`, password: `admin123`)
- ✅ All necessary relationships and triggers
- ✅ Database functions for stock updates and activity logging

## After Running SQL

1. Verify tables were created:
   - Go to **Table Editor** in Supabase
   - You should see: users, stalls, items, sales, credit_sales, stock_distribution, stock_additions, activity_log

2. Test the admin user:
   - Username: `admin`
   - Password: `admin123`
   - You can login with these credentials after deployment

3. **Important**: Change the admin password after first login!

## Need Help?

If you encounter errors:
- Make sure you're using the SQL Editor (not Query editor)
- Check that your Supabase project is fully provisioned
- Review error messages - some objects might already exist (that's OK)

