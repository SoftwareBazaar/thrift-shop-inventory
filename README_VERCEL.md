# Quick Start: Deploy to Vercel with Supabase

## 🚀 Quick Deployment Steps

### 1. Supabase Setup (5 minutes)

1. Create account at https://supabase.com
2. Create a new project
3. Go to **SQL Editor** → Run the SQL from `server/schema/init.sql`
4. Copy your **Project URL** and **Service Role Key** from Settings → API

### 2. Deploy to Vercel (2 minutes)

**Option A: Via GitHub**
1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables:
   - `SUPABASE_URL` = Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase Service Role Key
   - `JWT_SECRET` = Any secure random string (min 32 characters)
   - `REACT_APP_API_URL` = `/api`
5. Click **Deploy**

**Option B: Via CLI**
```bash
npm i -g vercel
vercel login
vercel
# Follow prompts, add environment variables when asked
vercel --prod
```

### 3. Set Environment Variables in Vercel

In your Vercel project dashboard → Settings → Environment Variables:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
JWT_SECRET=your-secure-random-string-here
REACT_APP_API_URL=/api
NODE_ENV=production
```

### 4. Test Your Deployment

1. Visit `https://your-app.vercel.app/api/health` - Should return `{"status":"OK"}`
2. Visit your main URL
3. Login with:
   - Username: `admin`
   - Password: `admin123`

## 📁 Project Structure

```
├── api/              # Vercel serverless functions
│   ├── auth/        # Authentication
│   ├── inventory/   # Inventory management  
│   ├── sales/       # Sales operations
│   └── users/       # User management
├── client/          # React frontend
├── lib/             # Shared libraries
│   └── supabase.js  # Supabase client
└── vercel.json      # Vercel configuration
```

## ✅ What's Included

- ✅ Supabase database integration
- ✅ JWT authentication
- ✅ Serverless API endpoints
- ✅ React frontend
- ✅ CORS configuration
- ✅ Environment variable setup

## 🔧 Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Create .env.local file
cat > .env.local << EOF
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
REACT_APP_API_URL=http://localhost:3000/api
EOF

# Run locally
vercel dev
```

## 📚 API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile
- `GET /api/inventory` - Get items
- `POST /api/inventory/create` - Create item
- `GET /api/sales` - Get sales
- `POST /api/sales/create` - Record sale

See `VERCEL_SUPABASE_SETUP.md` for complete documentation.

## ⚠️ Important Notes

1. **Never commit** `.env` files
2. Use strong `JWT_SECRET` in production
3. The default admin password is `admin123` - **Change it after first login!**
4. Supabase Service Role Key bypasses RLS - handle with care

## 🆘 Troubleshooting

**API not working?**
- Check environment variables in Vercel dashboard
- Verify Supabase tables are created
- Check Vercel function logs

**Frontend can't connect?**
- Ensure `REACT_APP_API_URL=/api` is set
- Check browser console for errors
- Verify CORS headers in `vercel.json`

**Database errors?**
- Verify SQL schema was run in Supabase
- Check Supabase project is active
- Review Supabase logs

For detailed setup, see `VERCEL_SUPABASE_SETUP.md`

