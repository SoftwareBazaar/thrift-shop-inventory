# 🚀 Production Setup Guide - Real Database with Real-Time Sync

This guide will help you set up the Thrift Shop Inventory System with **real database storage** and **real-time synchronization** across all users.

## 📋 Prerequisites

1. **Supabase Account** (Free tier available)
   - Sign up at: https://supabase.com
   - Create a new project

2. **Node.js** (v16 or higher)
3. **Git** (for cloning the repository)

---

## 🗄️ Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: `thrift-shop-inventory`
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait 2-3 minutes for project setup

### 1.2 Get Your Supabase Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 1.3 Set Up Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Copy the contents of `server/schema/init.sql`
3. Paste and run the SQL script
4. Verify tables are created:
   - `users`
   - `items`
   - `sales`
   - `stalls`
   - `stock_distribution`

### 1.4 Enable Real-Time (Important!)

1. Go to **Database** → **Replication**
2. Enable replication for:
   - ✅ `items`
   - ✅ `sales`
   - ✅ `users`
   - ✅ `stalls`

This enables real-time sync across all users!

---

## 🔧 Step 2: Configure Environment Variables

### 2.1 Create Environment File

Create a file `.env` in the `client/` folder:

```bash
cd client
cp .env.example .env
```

### 2.2 Add Your Supabase Credentials

Edit `client/.env`:

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
REACT_APP_API_URL=/api
```

**Important**: Replace with your actual Supabase credentials!

---

## 🚀 Step 3: Install Dependencies & Build

### 3.1 Install Dependencies

```bash
# From project root
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3.2 Build Production Version

```bash
# Build for production
cd client
npm run build
```

This creates an optimized production build in `client/build/`

---

## 📦 Step 4: Deploy to Vercel

### 4.1 Connect to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

### 4.2 Add Environment Variables in Vercel

1. Go to your project on Vercel dashboard
2. Go to **Settings** → **Environment Variables**
3. Add:
   - `REACT_APP_SUPABASE_URL` = Your Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` = Your Supabase anon key
4. Redeploy

---

## ✅ Step 5: Verify Real-Time Sync

### Test Real-Time Sync:

1. **Open two browser windows** (or use incognito)
2. **Login as admin** in both
3. **Add an item** in one window
4. **Check the other window** - it should appear automatically! 🎉

### Test Multi-User Sync:

1. **Window 1**: Login as admin
2. **Window 2**: Login as Kelvin (or Manuel)
3. **Admin adds item** → Should appear in Kelvin's view
4. **Kelvin records sale** → Should appear in admin's dashboard

---

## 🔄 Migration from Mock Data

If you have existing data in localStorage:

1. **Export data** from old version
2. **Import into Supabase** using the Supabase dashboard SQL editor
3. **Or use the backup/restore feature** in the Reports section

---

## 📊 Data Structure

### Users Table
- Admin user (username: `admin`, password: `admin123`)
- User accounts for each stall

### Items Table
- All inventory items with stock levels
- Categories and pricing

### Sales Table
- All sales records
- Payment types (cash, mobile, credit, split)
- Links to items and users

### Stock Distribution Table
- Tracks which items are distributed to which stalls
- Historical distribution records

---

## 🔒 Security Notes

1. **Anon Key is Safe**: The Supabase anon key is designed to be public
2. **Row Level Security (RLS)**: Enable RLS policies in Supabase for production
3. **Service Role Key**: Never expose in frontend (only for server-side)

---

## 🐛 Troubleshooting

### Real-Time Not Working?

1. Check Replication is enabled in Supabase dashboard
2. Verify environment variables are set correctly
3. Check browser console for errors
4. Ensure Supabase project is active (not paused)

### Data Not Appearing?

1. Check Supabase dashboard → Table Editor
2. Verify data is in database
3. Check browser console for errors
4. Try refreshing the page

### Build Errors?

1. Ensure all dependencies are installed: `npm install`
2. Check Node.js version: `node --version` (should be v16+)
3. Clear build cache: `rm -rf client/build node_modules/.cache`

---

## 📱 Client Handoff

### For Your Client:

1. **Share the Vercel deployment URL**
2. **Provide login credentials**:
   - Admin: `admin` / `admin123`
   - Users: (create as needed)

3. **Initial Setup**:
   - Client should change admin password immediately
   - Add initial inventory items
   - Set up stalls and assign users

4. **Support**:
   - All data is stored in Supabase
   - Real-time sync works automatically
   - No manual refresh needed

---

## 🎉 Success!

Your app is now:
- ✅ Using real database (Supabase)
- ✅ Real-time sync across all users
- ✅ Production-ready
- ✅ Scalable and secure

**Data entered by any user appears instantly for all users!**

---

## 📞 Next Steps

1. **Customize branding** (logo, colors, name)
2. **Set up email notifications** (optional)
3. **Configure backups** (Supabase provides automatic backups)
4. **Add more users** as needed
5. **Monitor usage** in Supabase dashboard

---

**Need Help?** Check Supabase documentation: https://supabase.com/docs

