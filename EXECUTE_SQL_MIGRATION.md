# Execute SQL Migration - CRITICAL STEP

## Overview
The atomic transaction functions and schema updates are ready but need to be executed on your Supabase database. This is a **critical step** to enable the race condition fixes.

---

## What This Migration Does

1. **Adds `buying_price` column** to items table (for profit calculations)
2. **Creates `create_sale_atomic()` RPC function** (atomic sales with row-level locking)
3. **Creates `distribute_stock_atomic()` RPC function** (atomic distribution with row-level locking)
4. **Removes duplicate trigger** (prevents double-decrement)
5. **Creates index on `buying_price`** (improves profit calculation performance)

---

## How to Execute

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire content of `add-atomic-transactions.sql`
6. Paste it into the query editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify: You should see "Success" messages for each operation

### Option 2: Using psql Command Line

```bash
# Connect to your Supabase database
psql -h db.xxxxx.supabase.co -U postgres -d postgres

# Paste the entire content of add-atomic-transactions.sql
# Then press Ctrl+D to execute
```

### Option 3: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push

# Or manually execute the SQL file
psql postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres < add-atomic-transactions.sql
```

---

## Verification Steps

After executing the migration, verify everything worked:

### 1. Check RPC Functions Exist

In Supabase Dashboard SQL Editor, run:

```sql
-- Check if create_sale_atomic function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'create_sale_atomic';

-- Check if distribute_stock_atomic function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'distribute_stock_atomic';
```

Expected output: Both functions should appear in results.

### 2. Check buying_price Column Exists

```sql
-- Check if buying_price column exists in items table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'items' AND column_name = 'buying_price';
```

Expected output: `buying_price | numeric`

### 3. Check Index Exists

```sql
-- Check if index on buying_price exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'items' AND indexname = 'idx_items_buying_price';
```

Expected output: `idx_items_buying_price`

### 4. Test RPC Function

```sql
-- Test create_sale_atomic function (this won't actually create a sale, just tests the function)
SELECT * FROM create_sale_atomic(
    1,           -- p_item_id
    5,           -- p_quantity_sold
    1000,        -- p_unit_price
    5000,        -- p_total_amount
    1,           -- p_stall_id
    'cash',      -- p_sale_type
    1            -- p_recorded_by
);
```

Expected output: Should return a row with the sale details (or error if item doesn't exist, which is fine).

---

## Troubleshooting

### Error: "Function already exists"
This is fine - it means the function was already created. The `CREATE OR REPLACE` statement will update it.

### Error: "Column already exists"
This is fine - it means the column was already added. The `IF NOT EXISTS` clause prevents errors.

### Error: "Permission denied"
Make sure you're using a role with sufficient permissions (usually `postgres` or `anon` with proper grants).

### Error: "Trigger does not exist"
This is fine - it means the trigger was already removed or never existed.

### RPC Functions Not Available in API
If the API still uses the fallback method:
1. Verify the functions were created successfully
2. Check that the function names match exactly: `create_sale_atomic`, `distribute_stock_atomic`
3. Restart the API server
4. Check API logs for RPC call attempts

---

## After Migration

### 1. Monitor API Logs
Watch for messages like:
- ✅ "RPC function succeeded" - Good, atomic transactions are working
- ⚠️ "RPC function not available, using fallback method" - Fallback is working, but RPC not available

### 2. Test Sales Creation
1. Create a test sale through the UI
2. Check API logs for RPC function call
3. Verify sale was recorded correctly
4. Verify stock was decremented

### 3. Test Stock Distribution
1. Distribute stock to a stall
2. Check API logs for RPC function call
3. Verify distribution was recorded
4. Verify stock was decremented

### 4. Test Profit Calculations
1. Go to Reports → Sales Report
2. Verify profit calculations are showing
3. Check that profit = revenue - cost
4. Export CSV and verify profit column is included

---

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop the RPC functions
DROP FUNCTION IF EXISTS create_sale_atomic CASCADE;
DROP FUNCTION IF EXISTS distribute_stock_atomic CASCADE;

-- Drop the index
DROP INDEX IF EXISTS idx_items_buying_price;

-- Remove buying_price column (optional, only if you want to completely revert)
-- ALTER TABLE items DROP COLUMN IF EXISTS buying_price;
```

---

## Timeline

- **Immediate**: Execute this migration
- **After execution**: Verify all steps above
- **Then**: Monitor API logs for 24 hours
- **Finally**: Confirm race conditions are fixed with concurrent user testing

---

## Support

If you encounter any issues:
1. Check the verification steps above
2. Review the error message carefully
3. Check Supabase documentation: https://supabase.com/docs
4. Review the SQL file for any syntax issues

---

## Next Steps After Migration

1. ✅ Execute this SQL migration
2. ✅ Verify RPC functions are created
3. ✅ Monitor API logs
4. ✅ Test concurrent sales from multiple users
5. ✅ Verify profit calculations work correctly
6. ✅ Deploy to production

---

**Status**: Ready to execute
**Priority**: HIGH - This fixes critical race conditions
**Estimated Time**: 2-5 minutes
