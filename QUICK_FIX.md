# 🚀 Quick Fix to Allow Login

## The Issue
The login page shows "Internal server error" because PostgreSQL requires authentication, but we don't know the password.

## 🔧 Quick Solution (Choose One)

### Option 1: Reset Password via Command Line (Fastest)

**Step 1: Open Command Prompt as Administrator**
- Press `Win + R`
- Type `cmd`
- Press `Ctrl + Shift + Enter` (to run as admin)

**Step 2: Run these commands one by one:**
```cmd
net stop postgresql-x64-18
cd "C:\Program Files\PostgreSQL\18\bin"
postgres.exe --single -D "C:\Program Files\PostgreSQL\18\data" postgres
```

**Step 3: In the PostgreSQL prompt that appears, type:**
```sql
ALTER USER postgres PASSWORD 'password123';
\q
```

**Step 4: Restart the service:**
```cmd
net start postgresql-x64-18
```

### Option 2: Use the Batch Script (Easier)

**Step 1: Right-click on `reset-postgres-password.bat`**
**Step 2: Select "Run as administrator"**
**Step 3: Follow the prompts**

### Option 3: Use pgAdmin (GUI Method)

**Step 1: Open pgAdmin 4 from Start Menu**
**Step 2: Try connecting with these passwords:**
- `password`
- `admin`
- `123456`
- `root`

**Step 3: Once connected:**
- Right-click "postgres" user → Properties
- Go to "Definition" tab
- Set password to `password123`
- Click Save

## ✅ After Password Reset

### 1. Update Configuration
The system will automatically update the `.env` file, but if not:

**Edit `.env` file:**
```env
DB_PASSWORD=password123
```

### 2. Run Database Setup
```cmd
node auto-setup-database.js
```

### 3. Restart Backend Server
```cmd
# Stop current server (Ctrl+C)
npm run server
```

### 4. Test Login
- Open http://localhost:3000
- Username: `admin`
- Password: `admin123`

## 🎯 Expected Result

After completing these steps:
- ✅ Database will be connected
- ✅ Login page will work
- ✅ You can access the full inventory management system
- ✅ All features will be functional

## 🆘 Still Having Issues?

If the above doesn't work:
1. **Check if PostgreSQL is running**: `services.msc` → Look for PostgreSQL service
2. **Try different passwords**: The system might have a custom password
3. **Reinstall PostgreSQL**: Uninstall and reinstall with a known password

---

**This should get your login working in under 5 minutes!** 🚀
