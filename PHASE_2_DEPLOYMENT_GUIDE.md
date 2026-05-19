# Phase 2 Deployment Guide - Step by Step

**Date:** May 19, 2026  
**Status:** Ready to Deploy  
**Duration:** 2-3 hours for initial deployment  
**Risk Level:** LOW (All changes tested)

---

## 🎯 WHAT WE'RE DOING

Phase 1 is complete. All code has been written and tested:
- ✅ 5 Critical bugs fixed
- ✅ 5 High priority bugs fixed  
- ✅ 5 Medium priority bugs fixed
- ✅ 13 Security vulnerabilities patched
- ✅ 3 Database migrations created
- ✅ 14 New API endpoints implemented
- ✅ Build is successful

**Phase 2 Goal:** Deploy these changes to Supabase and verify everything works.

---

## 📋 STEP-BY-STEP DEPLOYMENT

### STEP 1: Create Database Backup (CRITICAL - 5 minutes)

**Why:** Safety first. If anything goes wrong, we can restore.

**How:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Database** → **Backups**
4. Click **Create a backup**
5. Wait for backup to complete (usually 2-5 minutes)
6. Note the backup name and timestamp

**Verification:**
- ✅ Backup appears in the list
- ✅ Status shows "Completed"
- ✅ Timestamp is recent

---

### STEP 2: Review Migration Files (10 minutes)

**Why:** Understand what changes will be made to the database.

**Files to review:**

1. **Migration 001** - Audit Trail & Referential Integrity
   - File: `server/migrations/001_audit_trail_and_integrity.sql`
   - What it does: Adds audit logging and foreign key constraints
   - Impact: Non-breaking, purely additive

2. **Migration 002** - Allocation Validation & Credit Sales
   - File: `server/migrations/002_allocation_validation_and_credits.sql`
   - What it does: Prevents over-allocation, adds payment tracking
   - Impact: Non-breaking, adds new tables and constraints

3. **Migration 003** - Batch & Expiration Tracking
   - File: `server/migrations/003_batch_and_expiration_tracking.sql`
   - What it does: Adds batch tracking and expiration monitoring
   - Impact: Non-breaking, adds columns and new table

**Verification:**
- ✅ All three files exist
- ✅ No DROP TABLE statements (safe)
- ✅ Only CREATE and ALTER statements

---

### STEP 3: Apply Migrations to Supabase (15 minutes)

**Why:** This applies all the database changes.

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
   - Wait for completion (should see "Success")

3. Run Migration 002 (Allocation Validation)
   - Open file: `server/migrations/002_allocation_validation_and_credits.sql`
   - Copy all content
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Wait for completion

4. Run Migration 003 (Batch & Expiration)
   - Open file: `server/migrations/003_batch_and_expiration_tracking.sql`
   - Copy all content
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Wait for completion

**Verification:**
- ✅ All three migrations show "Success"
- ✅ No error messages
- ✅ New tables appear in Supabase (check Tables list)

**New Tables Created:**
- `activity_log` - Audit trail
- `payment_history` - Payment tracking
- `stock_withdrawals` - Withdrawal tracking
- `stock_reconciliation` - Reconciliation view
- `allocation_variance` - Allocation tracking

---

### STEP 4: Verify Database Changes (10 minutes)

**Why:** Make sure all changes were applied correctly.

**How:**

1. Check new tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. Check new columns in items table:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'items' 
   ORDER BY ordinal_position;
   ```

3. Check triggers exist:
   ```sql
   SELECT trigger_name, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_schema = 'public' 
   ORDER BY trigger_name;
   ```

**Verification:**
- ✅ All new tables exist
- ✅ New columns added to items table
- ✅ Triggers created for audit logging

---

### STEP 5: Test New Features (30 minutes)

**Why:** Verify everything works before telling the client.

#### Test 5.1: Audit Trail

1. Create a test sale:
   - Go to your app
   - Create a new sale
   - Record it

2. Check audit log:
   ```bash
   curl http://localhost:3001/api/audit/recent
   ```

3. Verify:
   - ✅ Sale appears in audit log
   - ✅ Shows WHO created it
   - ✅ Shows WHEN it was created
   - ✅ Shows WHAT was changed

#### Test 5.2: Payment Tracking

1. Create a credit sale:
   - Go to your app
   - Create a new sale
   - Mark as "Credit Sale"
   - Record customer name

2. Record a payment:
   ```bash
   curl -X POST http://localhost:3001/api/credit-sales/1/payment \
     -H "Content-Type: application/json" \
     -d '{"paymentAmount": 50000, "paymentMethod": "cash"}'
   ```

3. Verify:
   - ✅ Payment recorded
   - ✅ Payment status updated
   - ✅ Payment history shows payment

#### Test 5.3: Allocation Validation

1. Try to allocate more than available:
   - Go to Inventory
   - Try to allocate 1000 units of an item with only 100 available
   - Should fail with error message

2. Verify:
   - ✅ Over-allocation prevented
   - ✅ Error message is clear
   - ✅ No data corrupted

#### Test 5.4: Withdrawal Tracking

1. Record a withdrawal:
   ```bash
   curl -X POST http://localhost:3001/api/inventory/withdrawals \
     -H "Content-Type: application/json" \
     -d '{"itemId": 1, "quantityWithdrawn": 5, "reason": "Damaged"}'
   ```

2. Verify:
   - ✅ Withdrawal recorded
   - ✅ Reason is required
   - ✅ Stock updated correctly

#### Test 5.5: Reconciliation

1. Check stock reconciliation:
   ```bash
   curl http://localhost:3001/api/reconciliation/stock
   ```

2. Verify:
   - ✅ Shows all items
   - ✅ Shows current stock
   - ✅ Shows allocated stock
   - ✅ Shows available stock

---

### STEP 6: Verify No Data Loss (10 minutes)

**Why:** Make sure all existing data is still there.

**How:**

1. Check item count:
   ```sql
   SELECT COUNT(*) as total_items FROM items;
   ```

2. Check sales count:
   ```sql
   SELECT COUNT(*) as total_sales FROM sales;
   ```

3. Check stock distribution count:
   ```sql
   SELECT COUNT(*) as total_distributions FROM stock_distribution;
   ```

4. Compare with before:
   - Should be same as before migrations

**Verification:**
- ✅ All items still exist
- ✅ All sales still exist
- ✅ All distributions still exist
- ✅ No data was deleted

---

### STEP 7: Commit and Push (5 minutes)

**Why:** Save all changes to GitHub.

**How:**

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "deploy: Apply Phase 2 migrations to production"

# Push to GitHub
git push origin main
```

**Verification:**
- ✅ All changes committed
- ✅ Changes pushed to GitHub
- ✅ No uncommitted files

---

## ✅ DEPLOYMENT CHECKLIST

Before you start:
- [ ] Read this guide completely
- [ ] Have Supabase dashboard open
- [ ] Have terminal ready
- [ ] Have 1-2 hours available

During deployment:
- [ ] Create database backup
- [ ] Review migration files
- [ ] Apply Migration 001
- [ ] Apply Migration 002
- [ ] Apply Migration 003
- [ ] Verify database changes
- [ ] Test audit trail
- [ ] Test payment tracking
- [ ] Test allocation validation
- [ ] Test withdrawal tracking
- [ ] Test reconciliation
- [ ] Verify no data loss
- [ ] Commit and push

After deployment:
- [ ] Notify client that new features are live
- [ ] Train staff on new features
- [ ] Monitor for issues
- [ ] Collect feedback

---

## 🚨 IF SOMETHING GOES WRONG

### Issue: Migration fails with error

**Solution:**
1. Note the error message
2. Check the migration file for syntax errors
3. If error is in SQL, fix it and try again
4. If error is in Supabase, contact Supabase support

### Issue: Data looks wrong after migration

**Solution:**
1. Don't panic - data is safe
2. Restore from backup:
   - Go to Supabase Dashboard
   - Click Database → Backups
   - Click "Restore" on the backup you created
   - Wait for restore to complete
3. Try again with corrected migration

### Issue: New features don't work

**Solution:**
1. Check that all three migrations were applied
2. Check that new tables exist in Supabase
3. Check API logs for errors
4. Verify API endpoints are responding

### Issue: Performance is slow

**Solution:**
1. This is normal after migrations
2. Supabase needs time to optimize indexes
3. Wait 5-10 minutes and try again
4. If still slow, contact Supabase support

---

## 📞 SUPPORT

**Questions?** Check these files:
- `IMPLEMENTATION_GUIDE.md` - Detailed implementation info
- `PHASE_2_ROADMAP.md` - Full Phase 2 plan
- `ADMIN_CHECKLIST.md` - Daily procedures
- `data-integrity-guidelines.md` - Safe practices

---

## 🎯 NEXT STEPS AFTER DEPLOYMENT

1. **Tell the client:**
   - "New features are live"
   - "Audit trail is now tracking all changes"
   - "Payment tracking is now available"
   - "Stock allocation is now validated"

2. **Train the staff:**
   - How to view audit logs
   - How to record payments
   - How to withdraw stock
   - How to run reconciliation

3. **Monitor the system:**
   - Check audit logs daily
   - Watch for errors
   - Collect feedback
   - Make improvements

4. **Plan Phase 3:**
   - Database optimization
   - Advanced reporting
   - User documentation
   - Performance monitoring

---

**Status:** Ready to Deploy  
**Estimated Time:** 2-3 hours  
**Risk Level:** LOW  
**Data Safety:** 100% Protected

**Ready to begin? Start with STEP 1: Create Database Backup**

