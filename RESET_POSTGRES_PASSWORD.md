# 🔐 Reset PostgreSQL Password

## Method 1: Reset via Command Line (Recommended)

### Step 1: Stop PostgreSQL Service
```cmd
# Open Command Prompt as Administrator
net stop postgresql-x64-18
```

### Step 2: Start PostgreSQL in Single-User Mode
```cmd
# Navigate to PostgreSQL bin directory
cd "C:\Program Files\PostgreSQL\18\bin"

# Start in single-user mode
postgres.exe --single -D "C:\Program Files\PostgreSQL\18\data" postgres
```

### Step 3: Reset Password
In the PostgreSQL prompt that appears, type:
```sql
ALTER USER postgres PASSWORD 'newpassword123';
\q
```

### Step 4: Restart PostgreSQL Service
```cmd
net start postgresql-x64-18
```

### Step 5: Test Connection
```cmd
psql -U postgres -c "SELECT version();"
# Enter password: newpassword123
```

## Method 2: Using pgAdmin (GUI Method)

### Step 1: Open pgAdmin
1. **Start Menu** → Search "pgAdmin 4"
2. **Open pgAdmin 4**

### Step 2: Connect to Server
1. **Right-click** "Servers" in the left panel
2. **Select** "Create" → "Server"
3. **Name**: Local PostgreSQL
4. **Host**: localhost
5. **Port**: 5432
6. **Username**: postgres
7. **Password**: Try common passwords or leave blank

### Step 3: Reset Password
1. **Expand** "Servers" → "Local PostgreSQL" → "Login/Group Roles"
2. **Right-click** "postgres" → "Properties"
3. **Go to** "Definition" tab
4. **Set new password**
5. **Click** "Save"

## Method 3: Quick Setup with New Password

### If you want to use a simple password:
1. **Follow Method 1** above
2. **Set password to**: `password123`
3. **Update your .env file**:
   ```env
   DB_PASSWORD=password123
   ```
4. **Update setup-database.js**:
   ```javascript
   password: 'password123',
   ```

## Method 4: Reinstall PostgreSQL (Last Resort)

### If nothing else works:
1. **Uninstall PostgreSQL** from Control Panel
2. **Delete data folder**: `C:\Program Files\PostgreSQL\18\data`
3. **Reinstall PostgreSQL** with a known password
4. **Remember the password** you set during installation

## ✅ After Password Reset

### 1. Update Configuration Files
**Update .env file**:
```env
DB_PASSWORD=your_new_password
```

**Update setup-database.js**:
```javascript
password: 'your_new_password',
```

### 2. Run Database Setup
```cmd
node setup-database.js
```

### 3. Start the Application
```cmd
npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Login**: admin / admin123

## 🎯 Quick Solution

**If you want to get started quickly:**
1. **Use Method 1** to reset password to `password123`
2. **Update both .env and setup-database.js** with `password123`
3. **Run**: `node setup-database.js`
4. **Start**: `npm run dev`

---

**Need help?** The most common issue is forgetting the password set during PostgreSQL installation. Method 1 above will solve this quickly!
