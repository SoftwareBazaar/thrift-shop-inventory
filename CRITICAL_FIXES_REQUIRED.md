# CRITICAL FIXES REQUIRED - ACTION ITEMS

**Status:** 🔴 URGENT - Implement within 1 week
**Last Updated:** May 18, 2026
**Prepared by:** Kiro AI Assistant

---

## Summary

**5 CRITICAL issues** identified that could cause data loss or corruption. These must be fixed before the system accumulates more data.

---

## Issue #1: Double Stock Deduction ⚠️ CRITICAL

**What's happening:**
- When a sale is recorded, stock is decremented TWICE
- Once by the RPC function, once by the fallback API code
- Possibly a third time by the trigger

**Example:**
- Sell 10 units
- Stock decreases by 20-30 instead of 10
- After 100 sales, stock is off by 1000-3000 units

**How to fix (30 minutes):**

1. Open `add-atomic-transactions.sql`
2. Verify the `create_sale_atomic` function updates stock ONCE (line 51)
3. Open `api/sales/create.js`
4. Remove the manual stock update (lines 95-100):
   ```javascript
   // DELETE THIS SECTION:
   const { error: updateError } = await supabase
     .from('items')
     .update({ current_stock: item.current_stock - quantity_sold })
     .eq('item_id', item_id);
   ```
5. Verify `init.sql` has NO trigger on sales (should be removed in add-atomic-transactions.sql line 60)
6. Test: Create a sale, verify stock decreases by exactly the quantity sold

**Risk if not fixed:** Stock counts become completely unreliable

---

## Issue #2: Race Condition in Distribution ⚠️ CRITICAL

**What's happening:**
- Two users can distribute the same items simultaneously
- Both pass the stock check, both deduct from stock
- Result: Negative stock values

**Example:**
- Item has 100 units
- User A distributes 60 units
- User B distributes 60 units (at same time)
- Both succeed → stock becomes -20

**How to fix (45 minutes):**

1. Open `api/inventory/distribute.js`
2. Replace the distribution logic with atomic function call:
   ```javascript
   // Use the atomic function instead of manual operations
   const { data: result, error: rpcError } = await supabase
     .rpc('distribute_stock_atomic', {
       p_item_id: item_id,
       p_stall_id: stall_id,
       p_quantity_allocated: quantity,
       p_distributed_by: user.user_id
     });
   ```
3. Remove manual stock update logic
4. Test: Try to distribute more than available stock → should fail
5. Test: Distribute same item twice simultaneously → should fail on second

**Risk if not fixed:** Inventory becomes corrupted with concurrent operations

---

## Issue #3: Incomplete Transaction Handling ⚠️ CRITICAL

**What's happening:**
- Sale is recorded even if credit details or stock update fails
- Partial data left in database
- No way to rollback

**Example:**
- Sale recorded: ✓
- Credit details fail: ✗
- Stock update fails: ✗
- Result: Sale exists but stock not updated, credit not recorded

**How to fix (1 hour):**

1. Open `api/sales/create.js`
2. Wrap entire fallback section in try-catch with transaction:
   ```javascript
   try {
     // Start transaction
     const { data: sale, error: saleError } = await supabase
       .from('sales')
       .insert([...])
       .select()
       .single();
     
     if (saleError) throw saleError;
     
     // If credit sale, create credit record
     if (sale_type === 'credit') {
       const { error: creditError } = await supabase
         .from('credit_sales')
         .insert([...]);
       
       if (creditError) throw creditError; // THROW, don't ignore
     }
     
     // Update stock
     const { error: updateError } = await supabase
       .from('items')
       .update({ current_stock: item.current_stock - quantity_sold })
       .eq('item_id', item_id);
     
     if (updateError) throw updateError; // THROW, don't ignore
     
     // All succeeded
     return res.status(201).json({ message: 'Sale recorded', sale });
   } catch (error) {
     // Transaction failed - return error
     return res.status(500).json({ message: 'Sale failed: ' + error.message });
   }
   ```
3. Test: Try to create sale with invalid credit details → should fail completely
4. Test: Try to create sale with insufficient stock → should fail completely

**Risk if not fixed:** Data inconsistency grows with each failed operation

---

## Issue #4: Stock Calculation Formula Mismatch ⚠️ CRITICAL

**What's happening:**
- Different parts of the system calculate stock differently
- Withdrawals are not included in current_stock
- Reports show incorrect available stock

**Example:**
- Initial stock: 100
- Withdrawn: 20
- System shows: 100 available (should be 80)

**How to fix (2 hours):**

1. Standardize the formula everywhere:
   ```
   current_stock = initial_stock + total_added - total_distributed - total_sold - total_withdrawn
   ```

2. Update `api/inventory/index.js` to include withdrawals:
   ```javascript
   const total_withdrawn = item.stock_withdrawals?.reduce((sum, sw) => sum + (sw.quantity_withdrawn || 0), 0) || 0;
   const current_stock = (item.initial_stock || 0) + (item.total_added || 0) - (item.total_allocated || 0) - totalSoldForItem - total_withdrawn;
   ```

3. Create migration to recalculate all current_stock values:
   ```sql
   UPDATE items SET current_stock = (
     initial_stock + 
     COALESCE((SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = items.item_id), 0) -
     COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = items.item_id), 0) -
     COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = items.item_id), 0) -
     COALESCE((SELECT SUM(quantity_withdrawn) FROM stock_withdrawals WHERE item_id = items.item_id), 0)
   );
   ```

4. Test: Verify all products show correct current_stock

**Risk if not fixed:** All inventory reports are unreliable

---

## Issue #5: Missing Validation for Negative Stock ⚠️ CRITICAL

**What's happening:**
- Database allows negative stock values
- No validation in API endpoints
- Invalid data corrupts calculations

**Example:**
- Add -50 units → current_stock becomes negative
- Sell 1000 units when only 100 exist → succeeds

**How to fix (30 minutes):**

1. Add database constraints:
   ```sql
   ALTER TABLE items ADD CONSTRAINT check_current_stock_positive CHECK (current_stock >= 0);
   ALTER TABLE stock_additions ADD CONSTRAINT check_quantity_positive CHECK (quantity_added > 0);
   ALTER TABLE stock_distribution ADD CONSTRAINT check_quantity_positive CHECK (quantity_allocated > 0);
   ALTER TABLE sales ADD CONSTRAINT check_quantity_positive CHECK (quantity_sold > 0);
   ```

2. Add validation in all API endpoints:
   ```javascript
   if (quantity_added <= 0) {
     return res.status(400).json({ message: 'Quantity must be greater than 0' });
   }
   ```

3. Test: Try to add negative quantity → should fail
4. Test: Try to sell more than available → should fail

**Risk if not fixed:** Invalid data corrupts entire system

---

## Implementation Checklist

### Week 1 (URGENT)
- [ ] Fix Issue #1: Double stock deduction
- [ ] Fix Issue #2: Race condition in distribution
- [ ] Fix Issue #3: Incomplete transaction handling
- [ ] Fix Issue #4: Stock calculation formula
- [ ] Fix Issue #5: Negative stock validation
- [ ] Create database backup before implementing fixes
- [ ] Test all fixes thoroughly
- [ ] Deploy to production

### Week 2
- [ ] Monitor for any data issues
- [ ] Run full inventory reconciliation
- [ ] Verify all stock values are correct
- [ ] Document any issues found

### Week 3+
- [ ] Implement remaining HIGH severity fixes
- [ ] Implement MEDIUM severity fixes
- [ ] Add comprehensive test suite

---

## Testing Before Deployment

### Test 1: Double Stock Deduction
```
1. Note current stock of an item (e.g., 100)
2. Create a sale for 10 units
3. Verify stock is now 90 (not 80 or 70)
4. Repeat 5 times
5. Verify stock is now 50 (not 0 or negative)
```

### Test 2: Race Condition
```
1. Create item with 100 units
2. Open two browser windows
3. In window 1: Start distributing 60 units
4. In window 2: Start distributing 60 units (before window 1 completes)
5. Verify only one succeeds, other fails
6. Verify stock is 40 (not negative)
```

### Test 3: Transaction Handling
```
1. Create sale with invalid credit details
2. Verify sale is NOT recorded
3. Verify stock is NOT decremented
4. Verify error message is returned
```

### Test 4: Stock Calculation
```
1. Create item with initial_stock = 100
2. Add 50 units
3. Distribute 30 units
4. Sell 20 units
5. Withdraw 10 units
6. Verify current_stock = 100 + 50 - 30 - 20 - 10 = 90
```

### Test 5: Negative Stock Validation
```
1. Try to add -50 units → should fail
2. Try to sell 1000 units when only 100 exist → should fail
3. Try to distribute 1000 units when only 100 exist → should fail
```

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate:** Stop all operations
2. **Restore:** Restore database from backup (created before fixes)
3. **Investigate:** Determine what went wrong
4. **Fix:** Address the issue
5. **Test:** Thoroughly test before re-deploying

**Backup Location:** [Document where backup is stored]
**Restore Time:** ~30 minutes
**Data Loss:** None (if backup is recent)

---

## Questions?

If you have questions about any of these fixes:
1. Review DATA_INTEGRITY_ISSUES.md for full details
2. Check data-integrity-guidelines.md for procedures
3. Contact development team

---

**Prepared:** May 18, 2026
**Status:** READY FOR IMPLEMENTATION
**Priority:** 🔴 CRITICAL - DO NOT DELAY
