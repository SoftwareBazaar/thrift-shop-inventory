# Vercel + Supabase Setup Guide

This guide will help you deploy your Thrift Shop application to Vercel with Supabase as the database.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. A Supabase account (sign up at https://supabase.com)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Set Up Supabase Database

1. Go to https://supabase.com and create a new project
2. Wait for your project to be fully provisioned
3. Go to **Settings** > **API** and copy:
   - **Project URL** (SUPABASE_URL)
   - **Service Role Key** (SUPABASE_SERVICE_ROLE_KEY) - Keep this secret!
4. Go to **SQL Editor** in your Supabase dashboard
5. Run the SQL script from `server/schema/init.sql` to create all necessary tables
6. The script will create:
   - Users table with a default admin user (username: `admin`, password: `admin123`)
   - Stalls, Items, Sales, Credit Sales tables
   - All necessary relationships and triggers

## Step 2: Configure Environment Variables

### In Vercel Dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add the following variables:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_secure_jwt_secret_key_minimum_32_characters
NODE_ENV=production
REACT_APP_API_URL=/api
```

**Important:** Make sure to add these for all environments (Production, Preview, Development)

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. For production deployment:
   ```bash
   vercel --prod
   ```

### Option B: Deploy via GitHub Integration

1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Vercel will automatically detect the configuration from `vercel.json`
5. Add environment variables in the project settings
6. Click **Deploy**

## Step 4: Verify Deployment

1. After deployment, Vercel will provide you with a URL
2. Visit `https://your-app.vercel.app/api/health` to verify the API is working
3. Visit the main URL to access your application
4. Login with default admin credentials:
   - Username: `admin`
   - Password: `admin123`

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── auth/              # Authentication endpoints
│   ├── inventory/         # Inventory management
│   ├── sales/             # Sales operations
│   ├── users/             # User management
│   └── _middleware.js     # Shared authentication middleware
├── client/                # React frontend
├── lib/                   # Shared libraries
│   └── supabase.js        # Supabase client configuration
├── server/                # Original Express server (can be kept for local dev)
├── vercel.json            # Vercel configuration
└── package.json           # Dependencies
```

## API Endpoints

All API endpoints are prefixed with `/api`:

- `/api/health` - Health check
- `/api/auth/login` - User login
- `/api/auth/register` - Register new user (admin only)
- `/api/auth/profile` - Get/update user profile
- `/api/inventory` - Get/create inventory items
- `/api/inventory/[id]` - Get/update specific item
- `/api/sales` - Get/create sales records
- `/api/sales/summary` - Get sales summary/dashboard data
- `/api/users` - User management (admin only)
- `/api/users/stalls` - Stall management (admin only)

## Local Development

To run the application locally with Vercel serverless functions:

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Run locally:
   ```bash
   vercel dev
   ```

3. Create a `.env.local` file in the root directory:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   REACT_APP_API_URL=http://localhost:3000/api
   ```

## Troubleshooting

### API Routes Not Working

- Ensure `vercel.json` is correctly configured
- Check that all environment variables are set in Vercel dashboard
- Verify that Supabase tables are created correctly

### Database Connection Issues

- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- Check Supabase project status in dashboard
- Ensure network restrictions allow connections from Vercel

### Frontend Can't Connect to API

- Check that `REACT_APP_API_URL` is set correctly
- In production, it should be `/api` (relative path)
- Verify CORS settings if accessing from a different domain

## Security Notes

1. **Never commit** `.env` files or sensitive keys to Git
2. The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS) - use with caution
3. Consider implementing RLS policies in Supabase for additional security
4. Use strong, unique `JWT_SECRET` values for production
5. Regularly rotate API keys and secrets

## Next Steps

1. Set up Row Level Security (RLS) policies in Supabase for additional protection
2. Configure custom domain in Vercel
3. Set up monitoring and error tracking (e.g., Sentry)
4. Configure automatic backups for Supabase database
5. Review and optimize API endpoints for performance

## Support

For issues with:
- **Vercel**: Check https://vercel.com/docs
- **Supabase**: Check https://supabase.com/docs
- **This Project**: Review the codebase and existing documentation

