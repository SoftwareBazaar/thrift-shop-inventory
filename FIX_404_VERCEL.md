# 🔧 Fixing 404 Error on Vercel

## Common Causes of 404 Errors

1. **Build failed** - Check Vercel deployment logs
2. **Wrong output directory** - Should be `client/build`
3. **Missing build files** - Build might not have completed
4. **Routing issues** - React Router needs proper configuration

## Step 1: Check Vercel Build Logs

1. Go to your Vercel Dashboard
2. Click on your project
3. Go to **Deployments** tab
4. Click on the latest deployment
5. Check the **Build Logs** for errors

## Step 2: Verify Build Configuration

In Vercel Dashboard → Settings → General:

- **Build Command:** `cd client && npm install && npm run build`
- **Output Directory:** `client/build`
- **Install Command:** `npm install && cd client && npm install`
- **Root Directory:** `.` (leave empty or set to root)

## Step 3: Update Vercel Settings

If the build is failing, try these settings:

### Option A: Root Directory Method

1. Go to **Settings** → **General**
2. Set **Root Directory:** `client`
3. Set **Build Command:** `npm run build`
4. Set **Output Directory:** `build`
5. Set **Install Command:** `npm install`

### Option B: Keep Current Structure (Recommended)

Keep the current structure but ensure:
- Build Command: `cd client && npm install && npm run build`
- Output Directory: `client/build`
- Install Command: `npm install && cd client && npm install`

## Step 4: Check API Routes

Make sure your API routes are accessible:
- Test: `https://your-app.vercel.app/api/health`

If API routes work but frontend doesn't, it's a routing issue.

## Step 5: Verify vercel.json

Your `vercel.json` should have:
- Correct rewrites for React Router
- API route rewrites
- Proper headers

## Quick Fix: Rebuild

1. Go to Vercel Dashboard
2. Click on your project
3. Go to **Deployments**
4. Click **⋯** (three dots) on latest deployment
5. Click **Redeploy**

## Alternative: Use Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Check build locally first
cd client
npm run build
# Should create build/ folder
```

## Still Not Working?

1. **Check browser console** for JavaScript errors
2. **Check Network tab** for failed requests
3. **Verify environment variables** are set correctly
4. **Check if build folder exists** in your repository

## Common Build Errors

### Missing Dependencies
- **Fix:** Ensure both root and client `package.json` have all dependencies

### Build Fails
- **Fix:** Check build logs, fix TypeScript/ESLint errors

### Output Directory Not Found
- **Fix:** Verify `client/build` exists after local build

---

**Need help?** Share the build logs from Vercel and I can help diagnose!

