# Quick Fix Guide - Stock Flow Data Correction

**Status:** ✅ READY TO IMPLEMENT
**Time Required:** 5 minutes
**Risk Level:** 🟢 LOW
**Reversible:** Yes

---

## The Issue (In 30 Seconds)

Your stock flow shows wrong "New Items Added" values:
- **Pants:** Shows 93, should be 67
- **Sweat Pants:** Shows 34, should be [correct value]

**Why:** The database `total_added` field is out of sync with actual additions.

**Fix:** Recalculate from actual stock_additions records.

---

## How to Fix (Choose One)

### Option 1: Automatic Fix (Easiest) ⭐ RECOMMENDED

```bash
# 1. Backup database first (CRITICAL)
# Go to Supabase Dashboard → Database → Backups → Download

# 2. Run the fix script
node fix-stock-additions-data.js

# 3. Check the output
# Should show items fixed and changes made

# 4. Verify in UI
# Stock flow should now show correct values
```

**Time:** 5 minutes
**Effort:** Minimal
**Risk:** Very Low

---

### Option 2: Manual SQL Fix

```sql
-- 1. Backup first
CREATE TABLE items_backup AS SELECT * FROM items;

-- 2. Fix the data
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

-- 3. Verify
SELECT * FROM items WHERE total_added != (
  SELECT COALESCE(SUM(quantity_added), 0)
  FROM stock_additions
  WHERE stock_additions.item_id = items.item_id
);
-- Should return: 0 rows
```

**Time:** 10 minutes
**Effort:** Medium
**Risk:** Low

---

### Option 3: Fix Specific Items Only

If you only want to fix certain items:

```sql
-- For Pants (example)
UPDATE items
SET total_added = 67
WHERE item_name = 'Pants';

-- For Sweat Pants (example)
UPDATE items
SET total_added = [correct_value]
WHERE item_name = 'Sweat pants';
```

**Time:** 5 minutes
**Effort:** Low
**Risk:** Very Low

---

## Before You Start

### ✅ Checklist
- [ ] Create database backup
- [ ] Read STOCK_FLOW_FIX_EXPLANATION.md (optional)
- [ ] Choose fix method
- [ ] Have admin access ready

### 🚫 Don't Forget
- **BACKUP FIRST** - This is critical
- Test in development if possible
- Have rollback plan ready

---

## What Gets Fixed

### ✅ Changes
- `items.total_added` field updated to correct value
- Stock flow display shows correct "New Items Added"
- Total Received calculation becomes accurate

### ✅ Stays the Same
- Actual stock levels (current_stock)
- Distribution records
- Sales records
- All transactions
- No data is deleted

---

## Verification

### After Running Fix

```sql
-- Check if fix worked
SELECT 
  item_name,
  initial_stock,
  total_added,
  initial_stock + total_added as total_received
FROM items
WHERE item_name IN ('Pants', 'Sweat pants')
ORDER BY item_name;

-- Expected for Pants:
-- initial_stock: 62
-- total_added: 67
-- total_received: 129
```

### In UI
- Go to Inventory
- Click on Pants
- Check "Stock flow" section
- Should show: 62 initial + 67 added = 129 received

---

## Rollback (If Needed)

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

## FAQ

### Q: Will this affect my stock levels?
**A:** No. Only the `total_added` display value changes. Actual stock stays the same.

### Q: Will this affect sales or distributions?
**A:** No. Only the items table is updated. Sales and distributions are unchanged.

### Q: Can I undo this?
**A:** Yes. You have the backup and can restore anytime.

### Q: How long does it take?
**A:** 5 minutes for automatic fix, 10 minutes for manual SQL.

### Q: Is it safe?
**A:** Yes. Very low risk. Only changes display value, not actual data.

### Q: What if I have more items with wrong values?
**A:** The fix script checks ALL items and fixes any with wrong values.

---

## Step-by-Step (Automatic Fix)

### Step 1: Backup (2 minutes)
```
1. Go to Supabase Dashboard
2. Click Database → Backups
3. Click Download on latest backup
4. Save file: backup_20260518.sql
5. Store in safe location
```

### Step 2: Run Fix (2 minutes)
```bash
node fix-stock-additions-data.js
```

### Step 3: Verify (1 minute)
```
1. Go to Inventory
2. Click on Pants
3. Check Stock flow section
4. Should show: 62 + 67 = 129
```

**Total Time:** 5 minutes

---

## What the Fix Script Does

```javascript
1. Gets all items from database
2. For each item:
   - Sums all stock_additions
   - Compares with current total_added
   - If different, updates to correct value
3. Logs all changes
4. Shows summary
```

---

## Expected Output

```
🔧 Starting Stock Additions Data Fix...

Found 15 items to check

⚠️  Pants (ID: 1)
   Current total_added: 93
   Actual total: 67
   Difference: -26

   ✅ Updated to 67

============================================================
📊 SUMMARY
============================================================
Items fixed: 1
Total difference: -26

📝 Changes Made:
  • Pants: 93 → 67 (-26)

✅ Stock Additions Data Fix Complete!
```

---

## Common Issues

### Issue: Script not found
**Solution:** Make sure you're in the project root directory

### Issue: Database connection error
**Solution:** Check Supabase credentials in .env file

### Issue: Permission denied
**Solution:** Make sure you have admin access to database

### Issue: No changes made
**Solution:** All items already have correct values (good!)

---

## Next Steps After Fix

1. ✅ Verify stock flow displays correctly
2. ✅ Check Total Received = At Stalls + Sold
3. ✅ Test with multiple items
4. ✅ Monitor for any issues
5. ✅ Update documentation

---

## Support

### For Questions
- See: STOCK_FLOW_FIX_EXPLANATION.md (detailed explanation)
- See: DATA_INTEGRITY_ISSUES.md (related issues)

### For Issues
- Check rollback section above
- Restore from backup if needed
- Contact development team

---

## Summary

| Aspect | Details |
|--------|---------|
| **Issue** | total_added field has wrong values |
| **Fix** | Recalculate from stock_additions table |
| **Time** | 5 minutes |
| **Risk** | Very Low |
| **Reversible** | Yes |
| **Impact** | Display only, no actual data changes |
| **Recommended** | Option 1 (Automatic Fix) |

---

**Status:** ✅ READY TO IMPLEMENT
**Confidence:** 🟢 HIGH
**Recommendation:** Implement immediately

---

**Created:** May 18, 2026
**Last Updated:** May 18, 2026
**Version:** 1.0
