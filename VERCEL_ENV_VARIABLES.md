# 🔐 Vercel Environment Variables - Complete List

## Required Environment Variables for Vercel

After creating your new Vercel project, add these environment variables:

### Step 1: Go to Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Select your project: `thrift-shop-inventory`
3. Click **Settings** → **Environment Variables**

### Step 2: Add Each Variable

Add these variables for **Production**, **Preview**, and **Development** environments:

---

## 🔑 Required Variables

### 1. SUPABASE_URL
```
Variable Name: SUPABASE_URL
Value: https://droplfoogapyhlyvkmob.supabase.co
Environment: Production, Preview, Development
```

**Where to get:** Already set for your Supabase project

---

### 2. SUPABASE_SERVICE_ROLE_KEY
```
Variable Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Your Service Role Key from Supabase]
Environment: Production, Preview, Development
```

**How to get:**
1. Go to: https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api
2. Scroll to **"Project API keys"** section
3. Find the **"service_role"** key (marked as "secret")
4. Click **"Reveal"** and copy the key
5. **⚠️ Keep this secret!** Never share it publicly

---

### 3. JWT_SECRET
```
Variable Name: JWT_SECRET
Value: [Generate a secure random string - minimum 32 characters]
Environment: Production, Preview, Development
```

**How to generate:**
```bash
# Run this in your terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET`.

**Example format:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

---

### 4. NODE_ENV
```
Variable Name: NODE_ENV
Value: production
Environment: Production, Preview, Development
```

**Note:** Set to `production` for all environments on Vercel

---

### 5. REACT_APP_API_URL
```
Variable Name: REACT_APP_API_URL
Value: /api
Environment: Production, Preview, Development
```

**Note:** This tells the React app to use relative API paths (Vercel handles routing)

---

## 📋 Complete Environment Variables Table

| Variable Name | Value Example | Required | Where to Get |
|--------------|--------------|----------|--------------|
| `SUPABASE_URL` | `https://droplfoogapyhlyvkmob.supabase.co` | ✅ Yes | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | ✅ Yes | Supabase API Settings |
| `JWT_SECRET` | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...` | ✅ Yes | Generate with Node.js |
| `NODE_ENV` | `production` | ✅ Yes | Set manually |
| `REACT_APP_API_URL` | `/api` | ✅ Yes | Set manually |

---

## 🚀 Quick Setup Steps

### Step 1: Get Supabase Service Role Key

1. Visit: https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api
2. Scroll to **"Project API keys"**
3. Find **"service_role"** key
4. Click **"Reveal"** button
5. Copy the key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Step 2: Generate JWT Secret

Open terminal/command prompt and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (it will be a long random string).

### Step 3: Add to Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. For each variable:
   - Enter the **Variable Name**
   - Enter the **Value**
   - Select all environments: **Production**, **Preview**, **Development**
   - Click **"Save"**

### Step 4: Verify

After adding all variables:
1. Click **"Deployments"** tab
2. Click **"Redeploy"** on the latest deployment
3. Check build logs to ensure variables are loaded

---

## 📝 Example Values (DO NOT USE THESE - Generate Your Own!)

```env
# ⚠️ These are examples - generate your own values!

SUPABASE_URL=https://droplfoogapyhlyvkmob.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyb3BsZm9vZ2FweWhseXZrbW9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5ODc2NTIzNCwiZXhwIjoyMDE0MzQxMjM0fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
NODE_ENV=production
REACT_APP_API_URL=/api
```

---

## 🔒 Security Notes

1. **Never commit** these values to Git
2. **Never share** your Service Role Key publicly
3. **Generate a unique** JWT_SECRET for production
4. **Use different** JWT_SECRET for development and production
5. **Rotate secrets** periodically for security

---

## ✅ Verification Checklist

After adding all variables:

- [ ] `SUPABASE_URL` is set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (from Supabase dashboard)
- [ ] `JWT_SECRET` is generated and set (minimum 32 characters)
- [ ] `NODE_ENV` is set to `production`
- [ ] `REACT_APP_API_URL` is set to `/api`
- [ ] All variables are enabled for Production, Preview, and Development
- [ ] Redeployed after adding variables

---

## 🆘 Troubleshooting

### Variable Not Found Error
- Make sure you've added the variable in Vercel Dashboard
- Redeploy after adding variables
- Check that variable name matches exactly (case-sensitive)

### Supabase Connection Error
- Verify `SUPABASE_URL` is correct
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the service_role key (not anon key)
- Check Supabase project is not paused

### JWT Authentication Error
- Verify `JWT_SECRET` is set and is at least 32 characters
- Make sure same secret is used across all environments

---

**Ready to deploy?** Add these variables and redeploy! 🚀

