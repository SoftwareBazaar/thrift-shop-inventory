# Formula Fixes Needed Before Fresh Start

## ✅ What's Already Correct

1. **Sales trigger is disabled** - Sales don't deduct from `current_stock` ✅
2. **Distribution updates stock** - Distributions correctly deduct from `current_stock` ✅
3. **Withdrawal updates stock** - Withdrawals correctly deduct from `current_stock` ✅
4. **Stock additions update stock** - Additions correctly add to `current_stock` ✅

---

## ❌ Issues That Need Fixing

### Issue 1: Sales API Validation (CRITICAL)
**File:** `api/sales/create.js` line 107

**Current Code:**
```javascript
if (item.current_stock < quantity_sold) {
  return res.status(400).json({ message: 'Insufficient stock available' });
}
```

**Problem:** This checks central stock, but sales happen from stalls, not central.

**Fix:** Check stall stock instead:
```javascript
// Get stall's allocated stock
const { data: stallStock } = await supabase
  .from('stock_distribution')
  .select('quantity_allocated')
  .eq('item_id', item_id)
  .eq('stall_id', stall_id)
  .single();

const { data: stallSales } = await supabase
  .from('sales')
  .select('quantity_sold')
  .eq('item_id', item_id)
  .eq('stall_id', stall_id);

const totalSold = stallSales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
const availableAtStall = (stallStock?.quantity_allocated || 0) - totalSold;

if (availableAtStall < quantity_sold) {
  return res.status(400).json({ 
    message: `Insufficient stock at stall. Available: ${availableAtStall}` 
  });
}
```

---

### Issue 2: Allocation Trigger Validation
**File:** `server/migrations/002_allocation_validation.sql`

**Status:** Already fixed with `fix-allocation-trigger.sql` ✅

**Verify:** The trigger should check only the new allocation, not total allocations.

---

## 🔧 Recommended Fixes

### Fix 1: Update Sales API Validation

Run this to update the sales API:

```javascript
// In api/sales/create.js, replace lines 95-110 with:

// Check if stall has enough stock
const { data: distributions } = await supabase
  .from('stock_distribution')
  .select('quantity_allocated')
  .eq('item_id', item_id)
  .eq('stall_id', stall_id);

const totalAllocated = distributions?.reduce((sum, d) => sum + (d.quantity_allocated || 0), 0) || 0;

const { data: stallSales } = await supabase
  .from('sales')
  .select('quantity_sold')
  .eq('item_id', item_id)
  .eq('stall_id', stall_id);

const totalSold = stallSales?.reduce((sum, s) => sum + (s.quantity_sold || 0), 0) || 0;
const availableAtStall = totalAllocated - totalSold;

if (availableAtStall < quantity_sold) {
  return res.status(400).json({ 
    message: `Insufficient stock at stall. Available: ${availableAtStall}, Requested: ${quantity_sold}` 
  });
}
```

---

### Fix 2: Ensure Allocation Trigger is Correct

Run the `fix-allocation-trigger.sql` script if not already done.

---

## ✅ Verification Tests

After fixes, test these scenarios:

### Test 1: Sale from Stall
1. Distribute 10 units to Stall A
2. Try to sell 5 units from Stall A → Should succeed
3. Try to sell 6 units from Stall A → Should fail (only 5 left)
4. Verify `current_stock` in central did NOT decrease

### Test 2: Distribution
1. Have 20 units in central
2. Distribute 15 units to Stall B
3. Verify `current_stock` = 5
4. Verify "At Stalls" = 15

### Test 3: Batch Distribution
1. Have 50 units in central
2. Distribute 20 to Stall A and 25 to Stall B (total 45)
3. Both should succeed
4. Verify `current_stock` = 5

---

## 📋 Clean Start Checklist

Before importing CSV data:

- [ ] Fix sales API validation (check stall stock, not central)
- [ ] Verify allocation trigger is correct
- [ ] Test all scenarios above
- [ ] Clear all existing data
- [ ] Import clean CSV data
- [ ] Run verification tests again

---

**Status:** Fixes needed before fresh start  
**Priority:** HIGH - Fix sales validation  
**Date:** May 24, 2026
