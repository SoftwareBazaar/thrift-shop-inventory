# 🗄️ Database Setup Guide

## 🚀 Quick Setup (After PostgreSQL Installation)

### Step 1: Install PostgreSQL
1. **Download**: https://www.postgresql.org/download/windows/
2. **Run as Administrator**: Right-click installer → "Run as administrator"
3. **Install with**:
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4
   - ✅ Command Line Tools
   - **Port**: 5432
   - **Password**: Choose a strong password (REMEMBER IT!)

### Step 2: Update Database Password
Edit the `.env` file in your project root:
```env
DB_PASSWORD=your_actual_postgres_password
```

### Step 3: Run Database Setup
```bash
# From project root directory
node setup-database.js
```

This script will:
- ✅ Test database connection
- ✅ Create the `thrift_shop` database
- ✅ Run the database schema
- ✅ Set up all tables and relationships
- ✅ Create the default admin user

### Step 4: Start the Application
```bash
npm run dev
```

## 🔧 Manual Setup (Alternative)

If the automated script doesn't work:

### 1. Create Database
```sql
-- Open Command Prompt
psql -U postgres

-- In PostgreSQL prompt:
CREATE DATABASE thrift_shop;
\q
```

### 2. Run Schema
```bash
psql -U postgres -d thrift_shop -f server/schema/init.sql
```

### 3. Verify Setup
```sql
psql -U postgres -d thrift_shop

-- Check tables
\dt

-- Check users
SELECT * FROM users;

\q
```

## 🐛 Troubleshooting

### PostgreSQL Not Found
```bash
# Add PostgreSQL to PATH
# Add this to your system PATH:
C:\Program Files\PostgreSQL\15\bin
```

### Connection Refused
1. **Check if PostgreSQL is running**:
   - Open `services.msc`
   - Find "postgresql-x64-15" (or similar)
   - Right-click → Start

2. **Check port 5432**:
   ```bash
   netstat -ano | findstr :5432
   ```

### Wrong Password
1. **Reset postgres password**:
   ```bash
   # Stop PostgreSQL service
   net stop postgresql-x64-15
   
   # Start in single-user mode
   "C:\Program Files\PostgreSQL\15\bin\postgres.exe" --single -D "C:\Program Files\PostgreSQL\15\data" postgres
   
   # In the prompt:
   ALTER USER postgres PASSWORD 'new_password';
   \q
   
   # Start PostgreSQL service
   net start postgresql-x64-15
   ```

### Database Already Exists
```sql
-- Drop and recreate
DROP DATABASE IF EXISTS thrift_shop;
CREATE DATABASE thrift_shop;
```

## ✅ Verification

### Test Connection
```bash
psql -U postgres -d thrift_shop -c "SELECT version();"
```

### Check Tables
```sql
psql -U postgres -d thrift_shop

\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM items;
\q
```

### Test Application
1. **Start server**: `npm run server`
2. **Test API**: `curl http://localhost:5000/api/health`
3. **Start client**: `cd client && npm start`
4. **Open**: http://localhost:3000
5. **Login**: admin / admin123

## 🎯 Success Indicators

- ✅ PostgreSQL service is running
- ✅ Database `thrift_shop` exists
- ✅ All tables are created
- ✅ Default admin user exists
- ✅ Server starts without errors
- ✅ API responds to health check
- ✅ Frontend loads and shows login page

## 📞 Need Help?

1. **Check logs**: Look at console output for error messages
2. **Verify installation**: `psql --version`
3. **Test connection**: `psql -U postgres`
4. **Check services**: `services.msc` → PostgreSQL
5. **Review firewall**: Allow PostgreSQL through Windows Firewall

---

**Once everything is working, you'll have a fully functional inventory management system!** 🎉
