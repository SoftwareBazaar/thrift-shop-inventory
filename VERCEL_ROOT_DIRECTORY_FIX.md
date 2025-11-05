# Fix: Root Directory "client" Does Not Exist

## The Issue
Vercel says the "client" folder doesn't exist, but it does in your repo. This might be because:
1. The folder structure in the GitHub repo is different
2. The commit being deployed doesn't have the client folder
3. Case sensitivity issue

## Solution: Don't Use Root Directory

Instead of setting Root Directory to `client`, leave it **empty** and configure the build commands manually:

### Step 1: Clear Root Directory
1. Go to Vercel Settings → General
2. Find "Root Directory"
3. **Clear the field** (make it empty)
4. Click "Save"

### Step 2: Set Build Commands Manually
In the same Settings page, find "Build & Development Settings":

1. **Build Command:** Set to:
   ```
   cd client && npm install && npm run build
   ```

2. **Output Directory:** Set to:
   ```
   client/build
   ```

3. **Install Command:** Set to:
   ```
   npm install && cd client && npm install
   ```

4. **Framework Preset:** Leave as "Other" or "None"

### Step 3: Verify Client Folder is in Repo
Make sure the client folder is committed and pushed:

```bash
git add client/
git commit -m "Ensure client folder is in repo"
git push
```

### Step 4: Redeploy
1. Go to Deployments
2. Click ⋯ on latest deployment
3. Click "Redeploy"

## Alternative: Check GitHub Structure
If the above doesn't work, check your GitHub repo structure:
1. Go to: https://github.com/SoftwareBazaar/thrift-shop-inventory
2. Check if the `client` folder is visible
3. If not, you need to commit and push it

## Quick Fix Summary
- **Root Directory:** Leave EMPTY
- **Build Command:** `cd client && npm install && npm run build`
- **Output Directory:** `client/build`
- **Install Command:** `npm install && cd client && npm install`

Then redeploy!

