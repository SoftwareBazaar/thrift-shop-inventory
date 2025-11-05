# 🚀 Vercel Deployment Guide - Step by Step

## ✅ Pre-Deployment Checklist

- [x] Supabase database created and connected
- [x] All tables created successfully
- [x] Admin user exists (username: `admin`, password: `admin123`)
- [x] Local connection test passed
- [ ] Code pushed to GitHub/GitLab/Bitbucket
- [ ] Vercel account created

## Step 1: Push Your Code to Git

If you haven't already, push your code to a Git repository:

```bash
# Initialize git if not already done
git init

# Add all files (except .env which should be in .gitignore)
git add .

# Commit
git commit -m "Initial commit - Thrift Shop app with Supabase"

# Push to your repository (GitHub, GitLab, or Bitbucket)
git remote add origin YOUR_REPO_URL
git push -u origin main
```

⚠️ **IMPORTANT:** Make sure `.env` is in `.gitignore` - never commit your API keys!

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. **Go to Vercel:**
   - Visit: https://vercel.com/new
   - Sign in with GitHub/GitLab/Bitbucket

2. **Import Your Repository:**
   - Click "Import Project"
   - Select your repository
   - Click "Import"

3. **Configure Project:**
   - **Framework Preset:** Leave as default (Vercel will auto-detect)
   - **Root Directory:** Leave as `.` (root)
   - **Build Command:** `cd client && npm install && npm run build`
   - **Output Directory:** `client/build`
   - **Install Command:** `npm install`

4. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add these variables for **Production**, **Preview**, and **Development**:

   ```
   SUPABASE_URL=https://droplfoogapyhlyvkmob.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   JWT_SECRET=your_jwt_secret_here
   NODE_ENV=production
   REACT_APP_API_URL=/api
   ```

   ⚠️ **Get your values from your local `.env` file!**

5. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete (usually 2-5 minutes)

### Option B: Via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Add Environment Variables:**
   - Go to Vercel Dashboard > Your Project > Settings > Environment Variables
   - Add the same variables as listed above

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

## Step 3: Verify Deployment

After deployment completes:

1. **Check Your App URL:**
   - Vercel will provide you with a URL like: `https://your-app.vercel.app`
   - Visit the URL to see your app

2. **Test API Endpoints:**
   - Visit: `https://your-app.vercel.app/api/health`
   - Should return a success message

3. **Test Login:**
   - Go to your app URL
   - Login with:
     - Username: `admin`
     - Password: `admin123`

## Step 4: Environment Variables in Vercel

Copy these exact values from your local `.env` file:

### Required Variables:

| Variable Name | Value | Where to Get |
|--------------|-------|--------------|
| `SUPABASE_URL` | `https://droplfoogapyhlyvkmob.supabase.co` | Your `.env` file |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Your `.env` file |
| `JWT_SECRET` | Your JWT secret | Your `.env` file |
| `NODE_ENV` | `production` | Set to `production` |
| `REACT_APP_API_URL` | `/api` | Set to `/api` for Vercel |

### How to Add in Vercel:

1. Go to your project in Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Enter variable name and value
5. Select environments: **Production**, **Preview**, **Development**
6. Click **Save**
7. **Redeploy** your project for changes to take effect

## Step 5: Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

## Troubleshooting

### Build Fails

- Check build logs in Vercel Dashboard
- Ensure all dependencies are in `package.json`
- Verify `client/package.json` has all required dependencies

### API Routes Not Working

- Verify environment variables are set correctly
- Check that `REACT_APP_API_URL=/api` is set
- Ensure `vercel.json` is configured correctly

### Database Connection Errors

- Double-check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify Supabase project is not paused
- Check Supabase dashboard for any restrictions

### Frontend Can't Connect to API

- Verify `REACT_APP_API_URL=/api` is set
- Check browser console for errors
- Verify API routes are working: `https://your-app.vercel.app/api/health`

## Post-Deployment

### Security Checklist

- [ ] Change admin password after first login
- [ ] Verify all environment variables are set correctly
- [ ] Test all API endpoints
- [ ] Check that sensitive data is not exposed in frontend

### Next Steps

1. **Set up monitoring** (optional)
2. **Configure backups** in Supabase
3. **Set up custom domain** (optional)
4. **Enable analytics** (optional)

## Support

If you encounter issues:
- Check Vercel deployment logs
- Check Supabase dashboard for database status
- Review error messages in browser console
- Check API endpoint responses

## Quick Reference

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard/project/droplfoogapyhlyvkmob
- **Project URL:** Your Vercel deployment URL
- **API Base:** `https://your-app.vercel.app/api`

---

**Ready to deploy?** Follow the steps above and your app will be live in minutes! 🎉
