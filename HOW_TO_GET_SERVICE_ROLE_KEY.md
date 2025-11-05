# 🔑 How to Get Your Service Role Key

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard
Open this URL in your browser:
**https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api**

### 2. Find the Service Role Key
On the API Settings page, scroll down to find:
- **Project API keys** section
- Look for **"service_role"** key (it's marked as "secret")
- It will look something like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (a very long JWT token)

### 3. Copy the Key
Click the **eye icon** 👁️ to reveal it, then click **Copy** to copy the entire key.

⚠️ **IMPORTANT:** This key is SECRET - never share it or commit it to Git!

### 4. Update Your .env File

1. Open the `.env` file in your project root
2. Find this line:
   ```
   SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_YOUR_SERVICE_ROLE_KEY
   ```
3. Replace `REPLACE_WITH_YOUR_SERVICE_ROLE_KEY` with your actual key:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_key_here...
   ```
4. Save the file

### 5. Test the Connection
Run:
```bash
node test-supabase-connection.js
```

## Visual Guide

The Service Role Key should be in a section that looks like this:

```
Project API keys
┌─────────────────────────────────────────┐
│ anon key (public)                       │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ service_role key (secret) 👁️            │ ← THIS ONE!
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... │
└─────────────────────────────────────────┘
```

## Alternative: Direct Link
If you're logged into Supabase, you can go directly to:
**https://supabase.com/dashboard/project/droplfoogapyhlyvkmob/settings/api**

Then scroll to "Project API keys" and find the **service_role** key.

