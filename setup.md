# Thrift Shop Inventory Management System - Setup Guide

## Quick Start

### 1. Database Setup

**Install PostgreSQL** (if not already installed):
- Download from: https://www.postgresql.org/download/
- Install with default settings
- Remember the password you set for the 'postgres' user

**Create Database**:
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create the database
CREATE DATABASE thrift_shop;

-- Exit psql
\q
```

**Run Database Schema**:
```bash
# Navigate to the project directory
cd "C:\Users\wanya\Desktop\My library  2\Thrift Shop"

# Run the schema file
psql -U postgres -d thrift_shop -f server/schema/init.sql
```

### 2. Backend Setup

**Install Dependencies**:
```bash
# In the project root directory
npm install
```

**Create Environment File**:
Create a file named `.env` in the project root with the following content:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=thrift_shop
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

**Start Backend Server**:
```bash
npm run server
```

### 3. Frontend Setup

**Install Frontend Dependencies**:
```bash
# In a new terminal, navigate to client directory
cd client
npm install
```

**Start Frontend Development Server**:
```bash
npm start
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

**Default Login Credentials**:
- Username: `admin`
- Password: `admin123`

## Development Commands

### Run Both Frontend and Backend
```bash
# From project root
npm run dev
```

### Individual Services
```bash
# Backend only
npm run server

# Frontend only (from client directory)
npm start
```

## Database Management

### Reset Database
```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS thrift_shop;"
psql -U postgres -c "CREATE DATABASE thrift_shop;"
psql -U postgres -d thrift_shop -f server/schema/init.sql
```

### Backup Database
```bash
pg_dump -U postgres thrift_shop > backup.sql
```

### Restore Database
```bash
psql -U postgres -d thrift_shop < backup.sql
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Check if PostgreSQL is running
   - Verify database credentials in `.env` file
   - Ensure database `thrift_shop` exists

2. **Port Already in Use**:
   - Change PORT in `.env` file
   - Kill process using the port: `netstat -ano | findstr :5000`

3. **Frontend Build Errors**:
   - Delete `node_modules` and `package-lock.json`
   - Run `npm install` again

4. **CORS Errors**:
   - Check `CLIENT_URL` in `.env` file
   - Ensure frontend is running on correct port

### Logs and Debugging

**Backend Logs**:
- Check console output when running `npm run server`
- Database queries are logged to console

**Frontend Logs**:
- Check browser console (F12)
- Network tab shows API calls

## Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
DB_HOST=your_production_db_host
DB_PASSWORD=your_secure_password
JWT_SECRET=your_very_secure_jwt_secret
CLIENT_URL=https://your-domain.com
```

### Build for Production
```bash
# Build frontend
cd client
npm run build

# The built files will be in client/build/
```

## System Requirements

- **Node.js**: v14 or higher
- **PostgreSQL**: v12 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB for application, additional for data

## Security Notes

1. **Change Default Credentials**: Update admin password after first login
2. **Secure JWT Secret**: Use a strong, random JWT secret in production
3. **Database Security**: Use strong passwords and limit database access
4. **HTTPS**: Use HTTPS in production
5. **Environment Variables**: Never commit `.env` files to version control

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify all dependencies are installed
3. Ensure PostgreSQL is running
4. Check that all environment variables are set correctly

For additional help, refer to the main README.md file.
