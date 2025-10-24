# 🚀 Quick Start Guide - Thrift Shop Inventory System

## ✅ Issues Fixed:
- ✅ Added missing "start" script to package.json
- ✅ Fixed security vulnerabilities in dependencies
- ✅ Updated jspdf and jspdf-autotable versions
- ✅ Fixed @types/yup version compatibility
- ✅ Installed Tailwind CSS
- ✅ Created .env file with default configuration

## 🗄️ Database Setup (Required First)

### Step 1: Install PostgreSQL
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the password you set for 'postgres' user

### Step 2: Create Database
```sql
-- Open Command Prompt or PowerShell as Administrator
psql -U postgres

-- In PostgreSQL prompt:
CREATE DATABASE thrift_shop;
\q
```

### Step 3: Run Database Schema
```bash
# From project root directory
psql -U postgres -d thrift_shop -f server/schema/init.sql
```

## 🚀 Start the Application

### Option 1: Start Both Services (Recommended)
```bash
# From project root
npm run dev
```

### Option 2: Start Services Separately

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 🔑 Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

## 🔧 Configuration

### Update Database Password
Edit the `.env` file in the project root:
```env
DB_PASSWORD=your_actual_postgres_password
```

### Other Environment Variables
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=thrift_shop
DB_USER=postgres
DB_PASSWORD=your_password_here
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

## 🐛 Troubleshooting

### Database Connection Issues
1. **Check if PostgreSQL is running:**
   ```bash
   # Windows
   services.msc
   # Look for "postgresql" service
   ```

2. **Test database connection:**
   ```bash
   psql -U postgres -d thrift_shop
   ```

3. **Check database exists:**
   ```sql
   \l
   ```

### Port Already in Use
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID <process_id> /F
```

### Frontend Issues
```bash
# Clear cache and reinstall
cd client
rm -rf node_modules package-lock.json
npm install
npm start
```

### Backend Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run server
```

## 📊 System Status Check

### Test Backend API
```bash
curl http://localhost:5000/api/health
```
Should return: `{"status":"OK","timestamp":"..."}`

### Test Database Connection
The server will show connection status in the console when starting.

## 🎯 Next Steps After Setup

1. **Login** with admin credentials
2. **Create Users** in the Users section
3. **Add Stalls** and assign users
4. **Add Inventory Items**
5. **Distribute Stock** to stalls
6. **Record Sales** and test the system

## 📱 Features Available

- ✅ **Inventory Management**: Add items, track stock, distribute to stalls
- ✅ **Sales Recording**: Record cash and credit sales
- ✅ **User Management**: Create users and assign to stalls
- ✅ **Reports**: Generate PDF and Excel reports
- ✅ **Analytics**: Dashboard with key metrics
- ✅ **Mobile Responsive**: Works on all devices

## 🆘 Need Help?

1. Check the console logs for error messages
2. Verify PostgreSQL is running
3. Ensure all environment variables are correct
4. Make sure ports 3000 and 5000 are available

The system is now ready to use! 🎉
