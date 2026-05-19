# How to Run Migrations - Complete Guide

**Status:** All migration files are ready  
**Location:** `server/migrations/`  
**Files:**
- `001_audit_trail_simple.sql`
- `002_allocation_validation.sql`
- `003_batch_expiration.sql`

---

## 🎯 WHAT TO DO

You have 3 options to run these migrations:

### Option 1: Use Supabase SQL Editor (Easiest)
1. Open each SQL file
2. Copy the entire content
3. Paste into Supabase SQL Editor
4. Click RUN
5. Wait for "Success"

### Option 2: Use pgAdmin (If you have it)
1. Connect to your Supabase database
2. Open Query Tool
3. Copy-paste each migration file
4. Execute

### Option 3: Use Command Line (If you have psql)
```bash
psql -h your-db-host -U postgres -d your-db-name -f server/migrations/001_audit_trail_simple.sql
psql -h your-db-host -U postgres -d your-db-name -f server/migrations/002_allocation_validation.sql
psql -h your-db-host -U postgres -d your-db-name -f server/migrations/003_batch_expiration.sql
```

---

## 📋 STEP-BY-STEP (Using Supabase SQL Editor)

### Step 1: Run Migration 001

1. Open file: `server/migrations/001_audit_trail_simple.sql`
2. Copy ALL content
3. Go to Supabase SQL Editor
4. Paste the content
5. Click RUN
6. Wait for "Success"

**What it creates:**
- activity_log table
- payment_history table
- stock_withdrawals table
- 5 views (reconciliation, allocation_variance, pending_payments, recent_activity, etc.)

### Step 2: Run Migration 002

1. Open file: `server/migrations/002_allocation_validation.sql`
2. Copy ALL content
3. Go to Supabase SQL Editor
4. Paste the content
5. Click RUN
6. Wait for "Success"

**What it creates:**
- Validation constraints
- Foreign key constraints
- Validation functions
- Audit logging triggers

### Step 3: Run Migration 003

1. Open file: `server/migrations/003_batch_expiration.sql`
2. Copy ALL content
3. Go to Supabase SQL Editor
4. Paste the content
5. Click RUN
6. Wait for "Success"

**What it creates:**
- Batch tracking columns
- Expiration date tracking
- batch_inventory table
- 4 views (expired_stock, expiring_soon, batch_inventory_summary)
- Batch update triggers

---

## ✅ VERIFICATION AFTER EACH MIGRATION

After running each migration, verify it worked:

### After Migration 001:
```sql
SELECT * FROM activity_log LIMIT 1;
SELECT * FROM payment_history LIMIT 1;
SELECT * FROM stock_withdrawals LIMIT 1;
```

Should show the tables exist (even if empty).

### After Migration 002:
```sql
SELECT * FROM stock_distribution LIMIT 1;
```

Should work without errors (constraints added).

### After Migration 003:
```sql
SELECT * FROM batch_inventory LIMIT 1;
SELECT * FROM expired_stock LIMIT 1;
```

Should show the tables and views exist.

---

## 🆘 IF SOMETHING FAILS

### Error: "Table already exists"
- This is OK - the migration uses `IF NOT EXISTS`
- Just continue to the next migration

### Error: "Column already exists"
- This is OK - the migration uses `IF NOT EXISTS`
- Just continue to the next migration

### Error: "Function already exists"
- This is OK - the migration uses `DROP IF EXISTS` first
- Just continue to the next migration

### Error: Something else
- Note the error message
- Check the migration file for typos
- Try running just the problematic part
- Contact support if stuck

---

## 📊 WHAT GETS CREATED

### Tables:
- `activity_log` - Audit trail
- `payment_history` - Payment tracking
- `stock_withdrawals` - Withdrawal tracking
- `batch_inventory` - Batch tracking

### Views:
- `stock_reconciliation` - Stock summary
- `allocation_variance` - Allocation status
- `pending_payments` - Pending payments
- `recent_activity` - Recent changes
- `expired_stock` - Expired items
- `expiring_soon` - Items expiring soon
- `batch_inventory_summary` - Batch summary

### Functions:
- `validate_allocation()` - Prevent over-allocation
- `validate_withdrawal()` - Validate withdrawals
- `update_stock_after_withdrawal()` - Update stock
- `log_activity()` - Log changes
- `update_batch_on_sale()` - Update batch on sale
- `update_batch_on_withdrawal()` - Update batch on withdrawal
- `log_batch_activity()` - Log batch changes

### Triggers:
- `validate_allocation_trigger` - Validate allocations
- `validate_withdrawal_trigger` - Validate withdrawals
- `update_stock_after_withdrawal_trigger` - Update stock
- `log_payment_history` - Log payments
- `log_stock_withdrawals` - Log withdrawals
- `update_batch_on_sale_trigger` - Update batch on sale
- `update_batch_on_withdrawal_trigger` - Update batch on withdrawal
- `log_batch_inventory` - Log batch changes

---

## 🎯 NEXT STEPS AFTER MIGRATIONS

1. **Verify data counts** (should be same as before):
   ```sql
   SELECT COUNT(*) FROM items;
   SELECT COUNT(*) FROM sales;
   SELECT COUNT(*) FROM stock_distribution;
   SELECT COUNT(*) FROM stock_additions;
   SELECT COUNT(*) FROM stalls;
   ```

2. **Test new features:**
   - Try to allocate more than available (should fail)
   - Try to withdraw without reason (should fail)
   - Record a payment (should work)
   - Check audit log (should show activity)

3. **Commit to GitHub:**
   ```bash
   git add server/migrations/
   git commit -m "deploy: Run Phase 2 migrations successfully"
   git push origin main
   ```

---

## 📞 QUESTIONS?

**Q: Do I need to run them in order?**
A: Yes, run 001 first, then 002, then 003.

**Q: What if one fails?**
A: Note the error, fix it, and try again. The others should still work.

**Q: Will this affect my existing data?**
A: No, all migrations are additive. No data is deleted.

**Q: Can I rollback?**
A: Yes, you have backups in `backups2026-05-19/` folder.

---

**Status:** Ready to Deploy  
**Risk Level:** LOW  
**Data Safety:** 100% Protected

**Run the migrations now! 🚀**
