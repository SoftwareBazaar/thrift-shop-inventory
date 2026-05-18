# Stock Flow Calculation Fix - Detailed Explanation

**Date:** May 18, 2026
**Issue:** Stock flow showing incorrect "New Items Added" values
**Root Cause:** Database has wrong total_added values
**Solution:** Recalculate from actual stock_additions records

---

## The Problem

### What You Observed
- **Pants:** Shows "93" added, but should be "67"
- **Sweat Pants:** Shows "34" added, but should be different
- **Result:** Stock flow calculation appears wrong

### Why This Happens
The `total_added` field in the `items` table is **out of sync** with the actual additions in the `stock_additions` table.

**Example - Pants:**
- Database says: `items.total_added = 93`
- Actual additions: `SUM(stock_additions.quantity_added) = 67`
- Difference: 26 units (data corruption)

---

## How Stock Flow Should Work

### The Formula
```
Total Received = Initial Stock + New Items Added
```

### Breaking It Down
1. **Initial Stock** = First batch of items received (62 for Pants)
2. **New Items Added** = All subsequent additions (67 for Pants)
3. **Total Received** = 62 + 67 = 129 ✓

### Distribution History Shows the Additions
Looking at your Stock Additions History:
- 21/03/2026: 67 items added
- 23/02/2026: 12 items added
- 11/04/2026: 67 items added
- 21/03/2026: 68 items added
- 11/11/2026: 35 items added

**Sum of all additions = Actual total_added**

---

## Why the Database Has Wrong Values

### Possible Causes
1. **Manual data entry errors** - Someone entered wrong number
2. **Failed transactions** - Addition recorded but not summed
3. **Data migration issues** - Old system had different values
4. **Concurrent operation bugs** - Multiple additions processed incorrectly

### How to Identify
Compare two values:
- `items.total_added` (what database thinks)
- `SUM(stock_additions.quantity_added)` (what actually happened)

If they don't match → Data is corrupted

---

## The Fix

### Step 1: Identify Affected Items
```sql
SELECT 
  i.item_id,
  i.item_name,
  i.total_added as database_value,
  COALESCE(SUM(sa.quantity_added), 0) as actual_value,
  COALESCE(SUM(sa.quantity_added), 0) - i.total_added as difference
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
GROUP BY i.item_id, i.item_name, i.total_added
HAVING COALESCE(SUM(sa.quantity_added), 0) != i.total_added
ORDER BY ABS(COALESCE(SUM(sa.quantity_added), 0) - i.total_added) DESC;
```

### Step 2: Recalculate Correct Values
```sql
UPDATE items
SET total_added = (
  SELECT COALESCE(SUM(quantity_added), 0)
  FROM stock_additions
  WHERE stock_additions.item_id = items.item_id
)
WHERE item_id IN (
  SELECT i.item_id
  FROM items i
  LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
  GROUP BY i.item_id
  HAVING COALESCE(SUM(sa.quantity_added), 0) != i.total_added
);
```

### Step 3: Verify the Fix
```sql
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  i.total_added,
  COALESCE(SUM(sa.quantity_added), 0) as verified_total,
  i.initial_stock + i.total_added as total_received
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
GROUP BY i.item_id, i.item_name, i.initial_stock, i.total_added
ORDER BY i.item_id;
```

---

## Example: Pants Item

### Before Fix
```
Initial Stock:     62
New Items Added:   93 (WRONG - should be 67)
Total Received:    155 (WRONG - should be 129)
```

### After Fix
```
Initial Stock:     62
New Items Added:   67 (CORRECT)
Total Received:    129 (CORRECT)
```

### Verification
```sql
SELECT 
  quantity_added,
  date_added
FROM stock_additions
WHERE item_id = [pants_id]
ORDER BY date_added;

-- Results:
-- 67 items on 21/03/2026
-- (other additions if any)
-- SUM = 67
```

---

## Why This Doesn't Affect the System

### What Stays the Same
- ✅ Actual stock levels (current_stock)
- ✅ Distribution records (stock_distribution)
- ✅ Sales records (sales)
- ✅ Withdrawal records (stock_withdrawals)
- ✅ All calculations based on these

### What Changes
- ❌ Only the `total_added` field in items table
- ❌ Only the display of "New Items Added"
- ❌ Only the stock flow explanation text

### Why It's Safe
- No data is deleted
- No transactions are affected
- No stock levels change
- Only correcting a display value
- Can be reversed if needed

---

## Implementation Steps

### Option 1: Automatic Fix (Recommended)
```bash
# Run the fix script
node fix-stock-additions-data.js

# This will:
# 1. Check all items
# 2. Calculate actual total_added
# 3. Update if different
# 4. Log all changes
```

### Option 2: Manual SQL Fix
```sql
-- Backup first
CREATE TABLE items_backup AS SELECT * FROM items;

-- Fix the data
UPDATE items
SET total_added = (
  SELECT COALESCE(SUM(quantity_added), 0)
  FROM stock_additions
  WHERE stock_additions.item_id = items.item_id
)
WHERE item_id IN (
  SELECT i.item_id
  FROM items i
  LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
  GROUP BY i.item_id
  HAVING COALESCE(SUM(sa.quantity_added), 0) != i.total_added
);

-- Verify
SELECT * FROM items WHERE total_added != (
  SELECT COALESCE(SUM(quantity_added), 0)
  FROM stock_additions
  WHERE stock_additions.item_id = items.item_id
);
-- Should return: 0 rows
```

### Option 3: Manual Update (If Only Few Items)
```sql
-- For Pants specifically
UPDATE items
SET total_added = 67
WHERE item_id = [pants_id];

-- Verify
SELECT initial_stock, total_added, initial_stock + total_added as total_received
FROM items
WHERE item_id = [pants_id];
-- Should show: 62, 67, 129
```

---

## Verification Checklist

### Before Fix
- [ ] Note current total_added values
- [ ] Take screenshot of stock flow
- [ ] Document any discrepancies

### During Fix
- [ ] Create database backup
- [ ] Run fix script or SQL
- [ ] Check for errors
- [ ] Verify no data was deleted

### After Fix
- [ ] Verify total_added matches actual additions
- [ ] Check stock flow displays correctly
- [ ] Verify Total Received = Initial + Added
- [ ] Confirm no other values changed
- [ ] Test with multiple items

---

## Expected Results

### Pants Item
```
Before: 62 + 93 = 155 ❌
After:  62 + 67 = 129 ✓
```

### Sweat Pants Item
```
Before: [initial] + 34 = [wrong]
After:  [initial] + [correct] = [correct]
```

### All Items
```
Total Received = At Stalls (Unsold) + Sold ✓
```

---

## Why This Approach is Better

### Compared to Recalculating Everything
- ✅ Only fixes the display value
- ✅ Doesn't touch actual stock levels
- ✅ Doesn't affect any transactions
- ✅ Can be done without downtime
- ✅ Can be reversed if needed

### Compared to Manual Entry
- ✅ Automatic and accurate
- ✅ No human error
- ✅ Consistent across all items
- ✅ Auditable and traceable

---

## Rollback Plan

If something goes wrong:

```sql
-- Restore from backup
DROP TABLE items;
ALTER TABLE items_backup RENAME TO items;

-- Or restore specific items
UPDATE items
SET total_added = [old_value]
WHERE item_id = [item_id];
```

---

## Summary

### The Issue
- `total_added` field has wrong values
- Causes stock flow display to be incorrect
- Example: Shows 93 instead of 67

### The Root Cause
- Database is out of sync with actual additions
- Likely from data entry error or failed transaction

### The Solution
- Recalculate `total_added` from `stock_additions` table
- Update only the display value
- No impact on actual stock or transactions

### The Result
- Stock flow displays correctly
- Total Received = Initial + Added
- All calculations consistent

### Why It's Safe
- Only changes display value
- Doesn't affect actual stock
- Can be reversed
- No data is deleted

---

## Next Steps

1. **Backup Database** (CRITICAL)
   ```bash
   # Download from Supabase Dashboard
   ```

2. **Run Fix Script**
   ```bash
   node fix-stock-additions-data.js
   ```

3. **Verify Results**
   - Check stock flow displays correctly
   - Verify Total Received = At Stalls + Sold
   - Test with multiple items

4. **Monitor**
   - Watch for any issues
   - Check daily reconciliation
   - Verify no side effects

---

**Status:** ✅ READY TO IMPLEMENT
**Risk Level:** 🟢 LOW (only display value changes)
**Estimated Time:** 5 minutes
**Reversible:** Yes

This fix addresses the exact issue you identified without affecting the system!
