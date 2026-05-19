# Environment Variables Setup Guide

## Supabase Configuration

Your Supabase project is already set up! Here's what you need:

**Project URL:** `https://droplfoogapyhlyvkmob.supabase.co`

## Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api
2. Scroll to "Project API keys"
3. Copy the **service_role** key (it's marked as "secret")

## Create .env File

Create a `.env` file in the project root with:

```env
# Supabase Configuration
SUPABASE_URL=https://droplfoogapyhlyvkmob.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-chars

# Environment
NODE_ENV=development

# API URL
REACT_APP_API_URL=http://localhost:3000/api

# Client URL
CLIENT_URL=http://localhost:3000

# Server Port
PORT=5000
```

## Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET`.

## For Vercel Deployment

Add these in Vercel Dashboard > Settings > Environment Variables:

```
SUPABASE_URL=https://droplfoogapyhlyvkmob.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=your_secure_jwt_secret
NODE_ENV=production
REACT_APP_API_URL=/api
```

## Test Connection

After creating `.env`, test the connection:

```bash
node -e "require('dotenv').config(); const supabase = require('./lib/supabase.js'); console.log('✅ Supabase connected!');"
```

