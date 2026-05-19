# Fix: npm error ENOENT - package.json not found

## The Problem
Vercel can't find `package.json` because the install command is trying to run before Vercel is in the correct working directory.

## Solution: Fix Install Command

### Step 1: Update Install Command in Vercel

Go to Vercel Settings → General → Build & Development Settings:

**Install Command:** Change to:
```
npm install
```

**NOT:** `npm install && cd client && npm install`

The reason: Vercel will handle the client directory installation automatically when you run the build command.

### Step 2: Update Build Command

**Build Command:** Set to:
```
cd client && npm install && npm run build
```

This ensures:
1. First installs root dependencies (if any)
2. Then navigates to client and installs client dependencies
3. Then builds the React app

### Step 3: Keep Output Directory

**Output Directory:** 
```
client/build
```

### Step 4: Root Directory

**Root Directory:** Leave EMPTY (not set to "client")

### Step 5: Redeploy

1. Save all settings
2. Go to Deployments
3. Redeploy

## Alternative: Simpler Install Command

If the above still doesn't work, try:

**Install Command:**
```
npm install
```

**Build Command:**
```
npm run build
```

**Output Directory:**
```
client/build
```

And add this to your root `package.json` scripts (it's already there):
```json
"build": "cd client && npm install && npm run build"
```

This way Vercel will:
1. Run `npm install` at root (installs root deps)
2. Run `npm run build` which runs the script in package.json
3. That script handles the client build

## Summary

**Recommended Settings:**
- Root Directory: (empty)
- Install Command: `npm install`
- Build Command: `cd client && npm install && npm run build`
- Output Directory: `client/build`

Try this configuration!

