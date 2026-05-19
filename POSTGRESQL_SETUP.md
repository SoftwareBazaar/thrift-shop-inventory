# 🗄️ PostgreSQL Installation Guide

## Method 1: Download and Install PostgreSQL (Recommended)

### Step 1: Download PostgreSQL
1. **Go to**: https://www.postgresql.org/download/windows/
2. **Click**: "Download the installer"
3. **Select**: Latest version (PostgreSQL 15 or 16)
4. **Download**: The Windows installer (.exe file)

### Step 2: Install PostgreSQL
1. **Run the installer** as Administrator
2. **Choose installation directory** (default: C:\Program Files\PostgreSQL\15)
3. **Select components**:
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (Database management tool)
   - ✅ Stack Builder
   - ✅ Command Line Tools
4. **Set data directory** (default: C:\Program Files\PostgreSQL\15\data)
5. **Set password** for the 'postgres' superuser (REMEMBER THIS PASSWORD!)
6. **Set port** (default: 5432)
7. **Set locale** (default: Default locale)
8. **Complete installation**

### Step 3: Verify Installation
1. **Open Command Prompt** as Administrator
2. **Test connection**:
   ```cmd
   psql --version
   ```
3. **Connect to PostgreSQL**:
   ```cmd
   psql -U postgres
   ```
4. **Enter your password** when prompted
5. **You should see**: `postgres=#` prompt

## Method 2: Using Package Manager (Alternative)

### Using Chocolatey (if installed)
```cmd
# Install Chocolatey first (if not installed)
# Run PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install PostgreSQL
choco install postgresql
```

### Using Scoop (if installed)
```cmd
# Install Scoop first (if not installed)
# Run PowerShell
iwr -useb get.scoop.sh | iex

# Install PostgreSQL
scoop install postgresql
```

## Method 3: Using Docker (Advanced)

### Install Docker Desktop first, then:
```cmd
# Run PostgreSQL in Docker
docker run --name postgres-thrift -e POSTGRES_PASSWORD=password -e POSTGRES_DB=thrift_shop -p 5432:5432 -d postgres:15
```

## 🔧 After Installation

### 1. Start PostgreSQL Service
- **Windows Services**: Open `services.msc`
- **Find**: "postgresql-x64-15" (or similar)
- **Right-click**: Start (if not already running)
- **Set to**: Automatic startup

### 2. Create Database
```sql
-- Open Command Prompt
psql -U postgres

-- In PostgreSQL prompt:
CREATE DATABASE thrift_shop;
\q
```

### 3. Test Connection
```cmd
psql -U postgres -d thrift_shop
```

## 🐛 Troubleshooting

### PostgreSQL Service Not Starting
1. **Check Windows Services**:
   - Open `services.msc`
   - Find PostgreSQL service
   - Right-click → Properties → Start

2. **Check Port 5432**:
   ```cmd
   netstat -ano | findstr :5432
   ```

3. **Check Logs**:
   - Look in: `C:\Program Files\PostgreSQL\15\data\log\`
   - Check for error messages

### Connection Issues
1. **Wrong Password**: Reset postgres password
2. **Firewall**: Allow PostgreSQL through Windows Firewall
3. **Port Conflict**: Change PostgreSQL port if needed

### Reset PostgreSQL Password
```cmd
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

## ✅ Verification Steps

1. **Test psql command**:
   ```cmd
   psql --version
   ```

2. **Connect to database**:
   ```cmd
   psql -U postgres -d thrift_shop
   ```

3. **Check if database exists**:
   ```sql
   \l
   ```

4. **Exit PostgreSQL**:
   ```sql
   \q
   ```

## 🎯 Next Steps After PostgreSQL Installation

1. **Update .env file** with your PostgreSQL password
2. **Create database**: `CREATE DATABASE thrift_shop;`
3. **Run schema**: `psql -U postgres -d thrift_shop -f server/schema/init.sql`
4. **Start the application**: `npm run dev`

## 📱 GUI Tools (Optional)

### pgAdmin 4 (Included with PostgreSQL)
- **Access**: http://localhost/pgadmin4
- **Login**: Use your PostgreSQL credentials
- **Manage**: Databases, users, and tables visually

### Alternative: DBeaver
- **Download**: https://dbeaver.io/
- **Free**: Community Edition
- **Features**: Database management, SQL editor

---

**Need help?** Check the PostgreSQL documentation or contact support!
