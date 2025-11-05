# 🚀 Quick Setup Summary - Supabase + Vercel

## ✅ What's Been Done

1. ✅ **Supabase Database Created**
   - All 8 tables created (users, stalls, items, sales, etc.)
   - Admin user created (username: `admin`, password: `admin123`)
   - Functions and triggers set up

2. ✅ **Project Configuration**
   - Supabase project URL: `https://droplfoogapyhlyvkmob.supabase.co`
   - Anon key available
   - Vercel configuration ready

## 🔑 What You Need to Do

### Step 1: Get Service Role Key (Required)

1. Go to: https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api
2. Scroll to "Project API keys"
3. Copy the **service_role** key (it's marked as "secret")

### Step 2: Create .env File

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://droplfoogapyhlyvkmob.supabase.co
SUPABASE_SERVICE_ROLE_KEY=paste_your_service_role_key_here
JWT_SECRET=generate_a_secure_random_string_here_min_32_chars
NODE_ENV=development
REACT_APP_API_URL=http://localhost:3000/api
CLIENT_URL=http://localhost:3000
PORT=5000
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Test Connection

```bash
node test-supabase-connection.js
```

### Step 4: Deploy to Vercel

1. **Push to GitHub** (if not already done)

2. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect configuration

3. **Add Environment Variables in Vercel:**
   - Go to Project Settings > Environment Variables
   - Add these for **Production**, **Preview**, and **Development**:
     ```
     SUPABASE_URL=https://droplfoogapyhlyvkmob.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     JWT_SECRET=your_jwt_secret
     NODE_ENV=production
     REACT_APP_API_URL=/api
     ```

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete
   - Visit your app URL!

## 🎯 Default Login

- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Change the password after first login!**

## 📚 Files Created

- `SUPABASE_SETUP_COMPLETE.md` - Full setup details
- `ENV_SETUP.md` - Environment variables guide
- `test-supabase-connection.js` - Connection test script
- `.env.example` - Template for environment variables

## 🔗 Useful Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/droplfoogapyhlyvkmob
- **API Settings:** https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api
- **Table Editor:** https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/editor

## ✅ Ready to Go!

Once you have your Service Role Key and create the `.env` file, you're ready to:
1. Test locally
2. Deploy to Vercel
3. Start managing your thrift shop inventory!

