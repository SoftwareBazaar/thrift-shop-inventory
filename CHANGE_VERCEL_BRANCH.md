# 🔧 Change Vercel to Use Master Branch

## The Issue
Vercel is deploying from `main` branch (old code), but your fixes are on `master` branch.

## Quick Fix: Change Vercel Production Branch

### Step 1: Go to Vercel Settings
1. Open Vercel Dashboard
2. Click on your project: `thrift-shop-inventory`
3. Go to **Settings** → **Git**

### Step 2: Change Production Branch
1. Find **"Production Branch"** setting
2. Change it from `main` to `master`
3. Click **Save**

### Step 3: Also Verify Build Settings
While you're in Settings → General:

- **Root Directory:** `.` (or empty)
- **Build Command:** `npm run build`
- **Output Directory:** `client/build`
- **Install Command:** (leave empty)

### Step 4: Redeploy
1. Go to **Deployments** tab
2. Click **⋯** on latest deployment
3. Click **Redeploy**

## Why This Works
- Your fixes are on `master` branch
- Vercel will now deploy from `master` instead of `main`
- The new build script will be used
- Build should complete successfully

---

**Change the Production Branch to `master` in Vercel Settings → Git, then redeploy!**

