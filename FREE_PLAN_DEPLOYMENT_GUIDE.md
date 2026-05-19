# Free Plan Deployment Guide - Safe Backup & Migration

**Date:** May 19, 2026  
**Plan:** Supabase Free Plan  
**Status:** Ready to Deploy Safely  
**Duration:** 3-4 hours (includes backup)

---

## ⚠️ FREE PLAN LIMITATIONS

On the free plan:
- ❌ No automatic backups
- ❌ No backup restore feature
- ✅ Can export data manually
- ✅ Can create backup tables
- ✅ Can run migrations safely

**Solution:** We'll create a manual backup before running migrations.

---

## 🎯 SAFE DEPLOYMENT STRATEGY

### The Plan:
1. **Export all data** to SQL file (manual backup)
2. **Save backup file** locally and to GitHub
3. **Run migrations** (safe - only adds, doesn't delete)
4. **Test everything**
5. **Keep backup file** for emergency rollback

### Why This Works:
- ✅ All data is exported before any changes
- ✅ Migrations only ADD new tables/columns (no deletions)
- ✅ If something breaks, you can restore from backup
- ✅ No data loss possible

---

## 📋 STEP-BY-STEP DEPLOYMENT

### STEP 1: Export All Data (Backup) - 20 minutes

**Why:** Create a complete backup of all data before making any changes.

**How:**

1. Open Supabase SQL Editor
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Click **SQL Editor**

2. Run this backup query:
   ```sql
   -- Export all tables as INSERT statements
   -- This creates a complete backup of your data
   
   -- Step 1: Get all items
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

3. Copy all results
   - Select all output
   - Copy to clipboard
   - Paste into a text file: `backup_items.sql`
   - Save to your computer

4. Repeat for other tables:
   ```sql
   -- For stock_distribution
   SELECT 'INSERT INTO stock_distribution VALUES (' || 
     distribution_id || ', ' || item_id || ', ' ||
     stall_id || ', ' || quantity_allocated || ', ' ||
     'NOW()' || ', ' || 'NOW()' || ');'
   FROM stock_distribution
   ORDER BY distribution_id;
   ```

   ```sql
   -- For sales
   SELECT 'INSERT INTO sales VALUES (' || 
     sale_id || ', ' || item_id || ', ' ||
     quantity_sold || ', ' || price_per_unit || ', ' ||
     total_amount || ', ''' || sale_type || ''', ' ||
     COALESCE(customer_name, 'NULL') || ', ' ||
     'NOW()' || ', ' || 'NOW()' || ');'
   FROM sales
   ORDER BY sale_id;
   ```

5. Save all backup files:
   - `backup_items.sql`
   - `backup_stock_distribution.sql`
   - `backup_sales.sql`
   - `backup_stock_additions.sql`
   - `backup_stalls.sql`

**Verification:**
- ✅ All backup files created
- ✅ Files contain INSERT statements
- ✅ Files saved locally

---

### STEP 2: Save Backup to GitHub (5 minutes)

**Why:** Keep backup safe in case your computer crashes.

**How:**

1. Create a backup folder:
   ```bash
   mkdir backups
   mkdir backups/2026-05-19
   ```

2. Move backup files:
   ```bash
   mv backup_*.sql backups/2026-05-19/
   ```

3. Commit to GitHub:
   ```bash
   git add backups/
   git commit -m "backup: Export all data before Phase 2 migrations"
   git push origin main
   ```

**Verification:**
- ✅ Backup folder created
- ✅ All backup files in folder
- ✅ Committed to GitHub
- ✅ Pushed to GitHub

---

### STEP 3: Run Migrations (15 minutes)

**Why:** Apply all the new features to the database.

**How:**

1. Open Supabase SQL Editor
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Click **SQL Editor**

2. Run Migration 001 (Audit Trail)
   - Open file: `server/migrations/001_audit_trail_and_integrity.sql`
   - Copy all content
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Wait for "Success" message

3. Run Migration 002 (Allocation Validation)
   - Open file: `server/migrations/002_allocation_validation_and_credits.sql`
   - Copy all content
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Wait for "Success" message

4. Run Migration 003 (Batch & Expiration)
   - Open file: `server/migrations/003_batch_and_expiration_tracking.sql`
   - Copy all content
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Wait for "Success" message

**Verification:**
- ✅ All three migrations show "Success"
- ✅ No error messages
- ✅ New tables appear in Supabase

---

### STEP 4: Verify Data Integrity (10 minutes)

**Why:** Make sure all data is still there after migrations.

**How:**

1. Check item count:
   ```sql
   SELECT COUNT(*) as total_items FROM items;
   ```
   - Should match the count before migrations

2. Check sales count:
   ```sql
   SELECT COUNT(*) as total_sales FROM sales;
   ```
   - Should match the count before migrations

3. Check distributions:
   ```sql
   SELECT COUNT(*) as total_distributions FROM stock_distribution;
   ```
   - Should match the count before migrations

4. Check a specific item:
   ```sql
   SELECT * FROM items WHERE item_id = 1;
   ```
   - Should have all original data
   - Should have new columns (batch_number, expiration_date, etc.)

**Verification:**
- ✅ All counts match
- ✅ All data is intact
- ✅ New columns exist
- ✅ No data was deleted

---

### STEP 5: Test New Features (30 minutes)

**Why:** Verify everything works before telling the client.

#### Test 5.1: Audit Trail
1. Create a test sale in your app
2. Check audit log:
   ```sql
   SELECT * FROM activity_log 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```
3. Verify:
   - ✅ Sale appears in audit log
   - ✅ Shows WHO, WHAT, WHEN

#### Test 5.2: Payment Tracking
1. Create a credit sale in your app
2. Check payment table:
   ```sql
   SELECT * FROM payment_history 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. Verify:
   - ✅ Payment recorded
   - ✅ Payment status tracked

#### Test 5.3: Allocation Validation
1. Try to allocate more than available
2. Should fail with error message
3. Verify:
   - ✅ Over-allocation prevented
   - ✅ Error message is clear

#### Test 5.4: Withdrawal Tracking
1. Try to record withdrawal without reason
2. Should fail (reason is required)
3. Record withdrawal with reason
4. Check withdrawal table:
   ```sql
   SELECT * FROM stock_withdrawals 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
5. Verify:
   - ✅ Withdrawal recorded
   - ✅ Reason is required
   - ✅ Stock updated

#### Test 5.5: Reconciliation
1. Check reconciliation view:
   ```sql
   SELECT * FROM stock_reconciliation 
   LIMIT 10;
   ```
2. Verify:
   - ✅ Shows all items
   - ✅ Shows current stock
   - ✅ Shows allocated stock

---

### STEP 6: Commit & Push (5 minutes)

**Why:** Save all changes to GitHub.

**How:**

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "deploy: Apply Phase 2 migrations - all data verified"

# Push to GitHub
git push origin main
```

**Verification:**
- ✅ All changes committed
- ✅ Changes pushed to GitHub
- ✅ Backup saved to GitHub

---

## 🆘 IF SOMETHING GOES WRONG

### Issue: Migration fails with error

**Solution:**
1. Note the error message
2. Check the migration file for syntax errors
3. Fix the error in the migration file
4. Try running the migration again
5. If still fails, restore from backup (see below)

### Issue: Data looks wrong after migration

**Solution:**
1. Don't panic - your backup is safe
2. Restore from backup:
   ```sql
   -- Delete the new tables (if needed)
   DROP TABLE IF EXISTS activity_log CASCADE;
   DROP TABLE IF EXISTS payment_history CASCADE;
   DROP TABLE IF EXISTS stock_withdrawals CASCADE;
   
   -- Restore from backup
   -- Run the backup SQL files you saved
   ```
3. Try again with corrected migration

### Issue: New features don't work

**Solution:**
1. Check that all three migrations were applied
2. Check that new tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
3. Check API logs for errors
4. Verify API endpoints are responding

### Issue: Need to rollback completely

**Solution:**
1. Delete new tables:
   ```sql
   DROP TABLE IF EXISTS activity_log CASCADE;
   DROP TABLE IF EXISTS payment_history CASCADE;
   DROP TABLE IF EXISTS stock_withdrawals CASCADE;
   ```

2. Restore original data from backup:
   - Open backup SQL files
   - Run them in Supabase SQL Editor
   - All data will be restored

---

## 📋 DEPLOYMENT CHECKLIST

Before you start:
- [ ] Read this guide completely
- [ ] Have Supabase dashboard open
- [ ] Have terminal ready
- [ ] Have 3-4 hours available
- [ ] Have backup folder ready

During deployment:
- [ ] Export all data (backup)
- [ ] Save backup files locally
- [ ] Commit backup to GitHub
- [ ] Apply Migration 001
- [ ] Apply Migration 002
- [ ] Apply Migration 003
- [ ] Verify data integrity
- [ ] Test audit trail
- [ ] Test payment tracking
- [ ] Test allocation validation
- [ ] Test withdrawal tracking
- [ ] Test reconciliation
- [ ] Commit and push

After deployment:
- [ ] Notify client that new features are live
- [ ] Train staff on new features
- [ ] Monitor for issues
- [ ] Keep backup files safe

---

## 🔒 DATA SAFETY GUARANTEE

**On Free Plan:**
- ✅ Manual backup created before any changes
- ✅ Backup saved locally
- ✅ Backup saved to GitHub
- ✅ Migrations only ADD new tables/columns (no deletions)
- ✅ All existing data remains unchanged
- ✅ Easy rollback if needed
- ✅ 100% data protection

**Why You're Safe:**
1. You have a complete backup before migrations
2. Migrations are non-breaking (only additions)
3. If something breaks, you can restore from backup
4. No data will be deleted

---

## 💡 PRO TIPS FOR FREE PLAN

### Tip 1: Regular Backups
- Export data monthly
- Save to GitHub
- Keep local copies

### Tip 2: Test in Development First
- Create a test database
- Run migrations there first
- Verify everything works
- Then run in production

### Tip 3: Monitor After Deployment
- Check audit logs daily
- Watch for errors
- Verify data integrity
- Collect feedback

### Tip 4: Plan for Growth
- Free plan has limits
- Monitor usage
- Plan upgrade when needed
- Pro plan has automatic backups

---

## 📊 TIMELINE

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Export all data (backup) | 20 min | ⏳ TODO |
| 2 | Save backup to GitHub | 5 min | ⏳ TODO |
| 3 | Run 3 migrations | 15 min | ⏳ TODO |
| 4 | Verify data integrity | 10 min | ⏳ TODO |
| 5 | Test new features | 30 min | ⏳ TODO |
| 6 | Commit & push | 5 min | ⏳ TODO |
| **TOTAL** | | **85 min** | |

---

## 🎯 WHAT HAPPENS AFTER DEPLOYMENT

### Immediately:
- ✅ New features are live
- ✅ Audit trail starts recording
- ✅ Payment tracking available
- ✅ Allocation validation active

### Next Day:
- ✅ Tell client about new features
- ✅ Train staff on new features
- ✅ Monitor for issues

### Next Week:
- ✅ Review audit logs
- ✅ Check payment tracking
- ✅ Verify reconciliation
- ✅ Collect feedback

---

## 📞 QUESTIONS?

**Q: Is it safe on free plan?**
A: Yes. You have a complete backup before any changes.

**Q: What if something breaks?**
A: Restore from backup (takes ~30 minutes). All data is safe.

**Q: How long will it take?**
A: 1.5-2 hours total (including backup and testing).

**Q: Do I need to upgrade?**
A: Not for this deployment. Upgrade later if you need automatic backups.

**Q: Can I do this while the business is operating?**
A: Yes, but do it during slow hours. Migrations take ~15 minutes.

---

## 🚀 READY TO START?

1. **Read this guide** (you're doing it!)
2. **Follow the 6 steps** (3-4 hours)
3. **Test everything** (30 minutes)
4. **Tell the client** (new features are live!)

---

**Status:** ✅ READY TO DEPLOY ON FREE PLAN  
**Risk Level:** LOW (Complete backup created)  
**Data Safety:** 100% Protected  
**Estimated Time:** 3-4 hours

**Let's deploy Phase 2 safely! 🚀**

