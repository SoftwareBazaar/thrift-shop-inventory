# Inventory System Formulas Verification

This document verifies that all inventory calculations work correctly so no manual SQL edits are needed.

---

## 📊 Core Formulas

### 1. Total Inventory
```
Total Inventory = Initial Stock + Total Added
```
**Example:** 19 (initial) + 94 (added) = 113 total

**Where it's calculated:**
- Frontend: `Inventory.tsx` line 782
- Database: Calculated from `items.initial_stock + SUM(stock_additions.quantity_added)`

---

### 2. Available to Distribute (Current Stock)
```
Available = Total Inventory - Total Allocated - Total Sold
```
**OR**
```
Available = Initial + Added - Distributed - Sold - Withdrawn
```

**Example:** 113 (total) - 11 (at stalls) - 34 (sold) = 68 available

**Where it's updated:**
- When distributing: `current_stock = current_stock - quantity_allocated`
- When selling: Sales happen from stalls, NOT from central (so don't deduct from current_stock)
- When withdrawing: `current_stock = current_stock - quantity_withdrawn`
- When adding stock: `current_stock = current_stock + quantity_added`

---

### 3. At Stalls (Unsold)
```
At Stalls = Total Allocated - Total Sold
```

**Example:** 11 (allocated to stalls) - 0 (sold from those allocations) = 11 at stalls

**Where it's calculated:**
- Frontend: `Inventory.tsx` line 779
- Formula: `distributedLive = Math.max(0, (item.total_allocated || 0) - stallSoldForItem)`

---

### 4. Allocated So Far
```
Allocated So Far = At Stalls + Sold
```

**Example:** 11 (at stalls) + 34 (sold) = 45 allocated

**Where it's calculated:**
- Frontend: `Inventory.tsx` - sum of distributed and sold

---

### 5. Total Sold
```
Total Sold = SUM(sales.quantity_sold) WHERE item_id = X
```

**Where it's calculated:**
- Database: `SELECT SUM(quantity_sold) FROM sales WHERE item_id = ?`
- Frontend: Fetched from API

---

## 🔧 Automatic Updates (Triggers & Functions)

### When Distribution Happens:
1. ✅ Insert into `stock_distribution` table
2. ✅ Deduct from `items.current_stock`
3. ✅ Update `items.total_allocated`

**Handled by:** `distributeStock` API + database trigger

---

### When Sale Happens:
1. ✅ Insert into `sales` table
2. ✅ Update `items.total_sold`
3. ❌ **DO NOT** deduct from `items.current_stock` (sales happen from stalls, not central)

**Handled by:** `createSale` API

---

### When Stock Added:
1. ✅ Insert into `stock_additions` table
2. ✅ Add to `items.current_stock`
3. ✅ Update `items.total_added`

**Handled by:** `addStock` API

---

### When Stock Withdrawn:
1. ✅ Insert into `stock_withdrawals` table
2. ✅ Deduct from `items.current_stock`
3. ✅ Update `items.total_withdrawn`

**Handled by:** `createWithdrawal` API

---

## ⚠️ Current Issues Found

### Issue 1: Sales Deducting from Current Stock
**Problem:** Sales might be deducting from `current_stock` when they shouldn't.
**Fix Needed:** Verify that sales API does NOT update `current_stock`.

**Check:** `api/sales/create.js` - should NOT have `UPDATE items SET current_stock = current_stock - quantity_sold`

---

### Issue 2: Distribution Trigger Validation
**Problem:** The `validate_allocation()` trigger was checking total allocations instead of just the new allocation.
**Status:** Fixed with `fix-allocation-trigger.sql`

---

### Issue 3: Batch Distributions
**Problem:** When distributing to multiple stalls at once, the trigger validates each one separately, causing the second distribution to fail.
**Status:** Fixed - trigger now deducts stock immediately for each distribution.

---

## ✅ Verification Checklist

Before starting fresh with CSV data, verify these work correctly:

### Test 1: Add Stock
- [ ] Add 10 units to an item
- [ ] Verify `current_stock` increases by 10
- [ ] Verify `total_added` increases by 10
- [ ] Verify "Available to Distribute" increases by 10

### Test 2: Distribute Stock
- [ ] Distribute 5 units to a stall
- [ ] Verify `current_stock` decreases by 5
- [ ] Verify `total_allocated` increases by 5
- [ ] Verify "At Stalls (Unsold)" increases by 5
- [ ] Verify "Available to Distribute" decreases by 5

### Test 3: Record Sale
- [ ] Record sale of 2 units from the stall
- [ ] Verify `current_stock` stays the same (does NOT decrease)
- [ ] Verify `total_sold` increases by 2
- [ ] Verify "At Stalls (Unsold)" decreases by 2
- [ ] Verify "Sold" increases by 2

### Test 4: Withdraw Stock
- [ ] Withdraw 3 units from central
- [ ] Verify `current_stock` decreases by 3
- [ ] Verify `total_withdrawn` increases by 3
- [ ] Verify "Available to Distribute" decreases by 3

### Test 5: Batch Distribution
- [ ] Distribute 10 units to Stall A and 15 units to Stall B (total 25)
- [ ] Verify both distributions succeed
- [ ] Verify `current_stock` decreases by 25
- [ ] Verify "At Stalls (Unsold)" increases by 25

---

## 🔍 Files to Check

1. **Distribution API:** `api/inventory/distribute.js`
   - Should update `current_stock`
   - Should update `total_allocated`

2. **Sales API:** `api/sales/create.js`
   - Should NOT update `current_stock`
   - Should update `total_sold`

3. **Add Stock API:** `api/inventory/create.js` or `api/inventory/stock.js`
   - Should update `current_stock`
   - Should update `total_added`

4. **Withdrawal API:** `api/inventory/withdrawals.js`
   - Should update `current_stock`
   - Should update `total_withdrawn`

5. **Database Triggers:** `server/migrations/*.sql`
   - `validate_allocation()` - should check only new allocation, not total
   - Should deduct stock immediately

---

## 📝 CSV Import Format

When client provides CSV data, it should have:

### Items CSV:
```
item_name, category, initial_stock, unit_price, sku
Men's sweaters, Sweaters, 19, 250.00, SW-001
```

### Stock Additions CSV:
```
item_name, quantity_added, date_added
Men's sweaters, 100, 2026-03-24
Men's sweaters, 67, 2026-03-30
```

### Distributions CSV:
```
item_name, stall_name, quantity_allocated, date_distributed
Men's sweaters, Stall 307, 11, 2026-05-01
```

### Sales CSV:
```
item_name, stall_name, quantity_sold, unit_price, sale_type, date_sold
Men's sweaters, Stall 307, 1, 250.00, cash, 2026-05-24
```

---

## 🎯 Expected Results After Fresh Start

With clean CSV data:
- ✅ All formulas calculate correctly
- ✅ No manual SQL edits needed
- ✅ Real-time sync works
- ✅ Distributions work without errors
- ✅ Sales don't affect central stock
- ✅ Stock additions update immediately

---

## 🚀 Next Steps

1. **Verify all formulas** by running the tests above
2. **Fix any issues** found in the APIs
3. **Export current data** to CSV (if needed for reference)
4. **Clear database** (or create new tables)
5. **Import clean CSV data**
6. **Test end-to-end** to ensure everything works

---

**Status:** Ready for verification  
**Date:** May 24, 2026
