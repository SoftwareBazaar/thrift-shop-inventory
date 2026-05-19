# Phase 2 Deployment - Action Checklist (Do This Now)

**Date:** May 19, 2026  
**Status:** Ready to Deploy  
**Time Needed:** 3-4 hours  
**Risk:** LOW (Complete backup created first)

---

## 🎯 WHAT YOU'RE DOING

You're deploying Phase 2 to production. This adds:
- ✅ Audit trail (track all changes)
- ✅ Payment tracking (record payments)
- ✅ Allocation validation (prevent over-allocation)
- ✅ Withdrawal tracking (track stock movements)
- ✅ Reconciliation tools (verify stock)

**All existing data stays safe.** You're just adding new features.

---

## ✅ DEPLOYMENT CHECKLIST

### PART 1: BACKUP (20 minutes)

**Goal:** Create a complete backup of all data before making any changes.

**Steps:**

- [ ] Open Supabase Dashboard: https://app.supabase.com
- [ ] Select your project
- [ ] Click **SQL Editor** (left sidebar)
- [ ] Copy this query:
  ```sql
  SELECT COUNT(*) as total_items FROM items;
  SELECT COUNT(*) as total_sales FROM sales;
  SELECT COUNT(*) as total_distributions FROM stock_distribution;
  SELECT COUNT(*) as total_additions FROM stock_additions;
  SELECT COUNT(*) as total_stalls FROM stalls;
  ```
- [ ] Run the query and **write down the numbers:**
  - Total items: ___________
  - Total sales: ___________
  - Total distributions: ___________
  - Total additions: ___________
  - Total stalls: ___________

**These numbers should NOT change after migrations.**

---

### PART 2: EXPORT DATA (20 minutes)

**Goal:** Export all data to SQL files for backup.

**Steps:**

- [ ] In Supabase SQL Editor, run this query:
  ```sql
  -- Export items table
  SELECT 'INSERT INTO items VALUES (' || 
    item_id || ', ''' || item_name || ''', ' ||
    initial_stock || ', ' || total_added || ', ' ||
    COALESCE(current_stock, 0) || ', ' ||
    COALESCE(total_sold, 0) || ', ' ||
    COALESCE(total_withdrawn, 0) || ', ' ||
    'NOW()' || ', ' ||
    'NOW()' || ');'
  FROM items
  ORDER BY item_id;
  ```

- [ ] Copy all results
- [ ] Create a new file: `backup_items_20260519.sql`
- [ ] Paste the results into the file
- [ ] Save the file

- [ ] Repeat for other tables:
  ```sql
  -- Export sales table
  SELECT 'INSERT INTO sales VALUES (' || 
    sale_id || ', ' || item_id || ', ' ||
    quantity_sold || ', ' || price_per_unit || ', ' ||
    total_amount || ', ''' || sale_type || ''', ' ||
    COALESCE(customer_name, 'NULL') || ', ' ||
    'NOW()' || ', ' || 'NOW()' || ');'
  FROM sales
  ORDER BY sale_id;
  ```

- [ ] Create file: `backup_sales_20260519.sql`
- [ ] Paste and save

- [ ] Repeat for stock_distribution:
  ```sql
  -- Export stock_distribution table
  SELECT 'INSERT INTO stock_distribution VALUES (' || 
    distribution_id || ', ' || item_id || ', ' ||
    stall_id || ', ' || quantity_allocated || ', ' ||
    'NOW()' || ', ' || 'NOW()' || ');'
  FROM stock_distribution
  ORDER BY distribution_id;
  ```

- [ ] Create file: `backup_stock_distribution_20260519.sql`
- [ ] Paste and save

- [ ] Repeat for stock_additions:
  ```sql
  -- Export stock_additions table
  SELECT 'INSERT INTO stock_additions VALUES (' || 
    addition_id || ', ' || item_id || ', ' ||
    quantity_added || ', ' ||
    'NOW()' || ', ' || 'NOW()' || ');'
  FROM stock_additions
  ORDER BY addition_id;
  ```

- [ ] Create file: `backup_stock_additions_20260519.sql`
- [ ] Paste and save

- [ ] Repeat for stalls:
  ```sql
  -- Export stalls table
  SELECT 'INSERT INTO stalls VALUES (' || 
    stall_id || ', ''' || stall_name || ''', ' ||
    'NOW()' || ', ' || 'NOW()' || ');'
  FROM stalls
  ORDER BY stall_id;
  ```

- [ ] Create file: `backup_stalls_20260519.sql`
- [ ] Paste and save

**Verification:**
- [ ] All 5 backup files created
- [ ] Each file contains INSERT statements
- [ ] Files saved locally

---

### PART 3: SAVE BACKUP TO GITHUB (5 minutes)

**Goal:** Keep backup safe in GitHub.

**Steps:**

- [ ] Create a folder: `backups/2026-05-19/`
- [ ] Move all backup files into this folder
- [ ] Open terminal in project folder
- [ ] Run these commands:
  ```bash
  git add backups/
  git commit -m "backup: Export all data before Phase 2 migrations"
  git push origin main
  ```

- [ ] Verify on GitHub that backup files are there

**Verification:**
- [ ] Backup folder created
- [ ] All backup files in folder
- [ ] Committed to GitHub
- [ ] Pushed to GitHub

---

### PART 4: RUN MIGRATIONS (15 minutes)

**Goal:** Apply the 3 database migrations.

**Steps:**

- [ ] Open Supabase SQL Editor
- [ ] Open file: `server/migrations/001_audit_trail_and_integrity.sql`
- [ ] Copy ALL content
- [ ] Paste into Supabase SQL Editor
- [ ] Click **Run**
- [ ] Wait for "Success" message
- [ ] **Screenshot the success message**

- [ ] Open file: `server/migrations/002_allocation_validation_and_credits.sql`
- [ ] Copy ALL content
- [ ] Paste into Supabase SQL Editor
- [ ] Click **Run**
- [ ] Wait for "Success" message
- [ ] **Screenshot the success message**

- [ ] Open file: `server/migrations/003_batch_and_expiration_tracking.sql`
- [ ] Copy ALL content
- [ ] Paste into Supabase SQL Editor
- [ ] Click **Run**
- [ ] Wait for "Success" message
- [ ] **Screenshot the success message**

**Verification:**
- [ ] All 3 migrations show "Success"
- [ ] No error messages
- [ ] Screenshots saved

---

### PART 5: VERIFY DATA (10 minutes)

**Goal:** Make sure all data is still there.

**Steps:**

- [ ] In Supabase SQL Editor, run this query:
  ```sql
  SELECT COUNT(*) as total_items FROM items;
  SELECT COUNT(*) as total_sales FROM sales;
  SELECT COUNT(*) as total_distributions FROM stock_distribution;
  SELECT COUNT(*) as total_additions FROM stock_additions;
  SELECT COUNT(*) as total_stalls FROM stalls;
  ```

- [ ] Compare the numbers with what you wrote down earlier:
  - Total items: __________ (should match)
  - Total sales: __________ (should match)
  - Total distributions: __________ (should match)
  - Total additions: __________ (should match)
  - Total stalls: __________ (should match)

- [ ] Check that new tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name;
  ```

- [ ] Look for these new tables:
  - [ ] activity_log
  - [ ] payment_history
  - [ ] stock_withdrawals

**Verification:**
- [ ] All counts match
- [ ] All new tables exist
- [ ] No data was deleted

---

### PART 6: TEST NEW FEATURES (30 minutes)

**Goal:** Verify everything works.

#### Test 6.1: Audit Trail
- [ ] Go to your app
- [ ] Create a test sale
- [ ] Go back to Supabase SQL Editor
- [ ] Run this query:
  ```sql
  SELECT * FROM activity_log 
  ORDER BY created_at DESC 
  LIMIT 5;
  ```
- [ ] Verify:
  - [ ] Your sale appears in the log
  - [ ] Shows the action (INSERT, UPDATE, etc.)
  - [ ] Shows the timestamp

#### Test 6.2: Payment Tracking
- [ ] Go to your app
- [ ] Create a credit sale
- [ ] Go to Supabase SQL Editor
- [ ] Run this query:
  ```sql
  SELECT * FROM payment_history 
  ORDER BY created_at DESC 
  LIMIT 5;
  ```
- [ ] Verify:
  - [ ] Payment table exists
  - [ ] Can see payment records

#### Test 6.3: Allocation Validation
- [ ] Go to your app
- [ ] Try to allocate 1000 units of an item that only has 100
- [ ] Should fail with error message
- [ ] Verify:
  - [ ] Over-allocation prevented
  - [ ] Error message is clear

#### Test 6.4: Withdrawal Tracking
- [ ] Go to Supabase SQL Editor
- [ ] Run this query:
  ```sql
  SELECT * FROM stock_withdrawals 
  ORDER BY created_at DESC 
  LIMIT 5;
  ```
- [ ] Verify:
  - [ ] Table exists
  - [ ] Can see withdrawal records

#### Test 6.5: Reconciliation
- [ ] Go to Supabase SQL Editor
- [ ] Run this query:
  ```sql
  SELECT * FROM stock_reconciliation 
  LIMIT 10;
  ```
- [ ] Verify:
  - [ ] View exists
  - [ ] Shows stock data

**Verification:**
- [ ] All 5 features tested
- [ ] No errors
- [ ] Everything works

---

### PART 7: COMMIT & PUSH (5 minutes)

**Goal:** Save all changes to GitHub.

**Steps:**

- [ ] Open terminal in project folder
- [ ] Run these commands:
  ```bash
  git status
  git add .
  git commit -m "deploy: Apply Phase 2 migrations - all data verified"
  git push origin main
  ```

- [ ] Verify on GitHub that changes are there

**Verification:**
- [ ] All changes committed
- [ ] Changes pushed to GitHub
- [ ] No uncommitted files

---

## 🎉 YOU'RE DONE!

### What You've Accomplished:
- ✅ Created complete backup of all data
- ✅ Saved backup to GitHub
- ✅ Applied 3 database migrations
- ✅ Verified all data is intact
- ✅ Tested all new features
- ✅ Committed changes to GitHub

### What's Now Live:
- ✅ Audit trail (tracks all changes)
- ✅ Payment tracking (records payments)
- ✅ Allocation validation (prevents over-allocation)
- ✅ Withdrawal tracking (tracks stock movements)
- ✅ Reconciliation tools (verifies stock)

### Next Steps:
1. **Tell the client:** "New features are live!"
2. **Train the staff:** Show them how to use new features
3. **Monitor the system:** Check for any issues
4. **Collect feedback:** Ask what they think

---

## 🆘 IF SOMETHING GOES WRONG

### Problem: Migration fails with error
**Solution:**
1. Note the error message
2. Check the migration file for typos
3. Fix the error
4. Try running the migration again
5. If still fails, restore from backup

### Problem: Data looks wrong
**Solution:**
1. Don't panic - your backup is safe
2. Delete the new tables:
   ```sql
   DROP TABLE IF EXISTS activity_log CASCADE;
   DROP TABLE IF EXISTS payment_history CASCADE;
   DROP TABLE IF EXISTS stock_withdrawals CASCADE;
   ```
3. Restore from backup files
4. Try again

### Problem: New features don't work
**Solution:**
1. Check that all 3 migrations were applied
2. Check that new tables exist
3. Check API logs for errors
4. Restart the app

---

## 📞 QUESTIONS?

**Q: Is it safe?**
A: Yes. You have a complete backup before any changes.

**Q: What if something breaks?**
A: Restore from backup (takes ~30 minutes). All data is safe.

**Q: How long will it take?**
A: 3-4 hours total (including backup and testing).

**Q: Can I do this while the business is operating?**
A: Yes, but do it during slow hours. Migrations take ~15 minutes.

---

## ✅ FINAL CHECKLIST

Before you start:
- [ ] Read this entire checklist
- [ ] Have Supabase dashboard open
- [ ] Have terminal ready
- [ ] Have 3-4 hours available
- [ ] Have backup folder ready

After you finish:
- [ ] All 7 parts completed
- [ ] All verifications passed
- [ ] Changes committed to GitHub
- [ ] Backup saved to GitHub
- [ ] Ready to tell the client

---

**Status:** ✅ READY TO DEPLOY  
**Risk Level:** LOW  
**Data Safety:** 100% Protected  
**Time Needed:** 3-4 hours

**Let's do this! 🚀**

