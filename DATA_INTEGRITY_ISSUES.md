# Data Integrity Issues - Thrift Shop Inventory System

**Last Updated:** May 18, 2026
**Status:** CRITICAL ISSUES IDENTIFIED - FIXES REQUIRED

---

## Executive Summary

Analysis of the Thrift Shop inventory system identified **15 potential data integrity issues**, including **5 CRITICAL** issues that could cause:
- Stock corruption and negative inventory values
- Data loss from incomplete transactions
- Race conditions in concurrent operations
- Orphaned or inconsistent records

**Immediate Action Required:** Implement fixes for Critical and High severity issues before further data accumulation.

---

## 🔴 CRITICAL SEVERITY ISSUES

### 1. Double Stock Deduction in Sales (CRITICAL)
**Location:** `api/sales/create.js` + `add-atomic-transactions.sql`
**Problem:**
- Stock is decremented by BOTH the RPC function AND the fallback API code
- Trigger `trigger_update_current_stock` may also fire, causing triple deduction
- Concurrent sales can result in negative stock values

**Impact:** Every sale potentially reduces stock by 2-3x the actual quantity
**Example:** Sell 10 units → current_stock decreases by 20-30 instead of 10

**Fix Required:**
- [ ] Choose ONE method: either RPC function OR trigger, not both
- [ ] Remove trigger `trigger_update_current_stock` from init.sql
- [ ] Ensure RPC function is the single source of truth
- [ ] Add validation to prevent negative stock

**Risk if not fixed:** Stock counts become completely unreliable

---

### 2. Race Condition in Distribution (CRITICAL)
**Location:** `api/inventory/distribute.js`
**Problem:**
- No row-level locking between stock check and distribution insert
- Two concurrent requests can both pass the stock check, then both deduct
- Example: 100 units available, two requests for 60 each both succeed → -20 units

**Impact:** Negative stock, inventory corruption
**Frequency:** High in multi-user environments

**Fix Required:**
- [ ] Use `FOR UPDATE` locking in distribution query (like in atomic function)
- [ ] Wrap in transaction with proper error handling
- [ ] Add CHECK constraint: `current_stock >= 0`

**Risk if not fixed:** Inventory becomes corrupted with concurrent operations

---

### 3. Incomplete Transaction Handling (CRITICAL)
**Location:** `api/sales/create.js` (lines 85-100)
**Problem:**
- Sale is inserted (line 75) but if credit_sales insert fails (line 85), sale remains without credit details
- If stock update fails (line 95), sale is recorded with incorrect stock
- No rollback mechanism - partial failures leave inconsistent data
- Comment acknowledges: "Note: Sale is already recorded, credit record is optional"

**Impact:** Orphaned sales records, credit sales without customer details, stock mismatches
**Data Loss:** Sales recorded but stock not updated = inventory appears to have items it doesn't

**Fix Required:**
- [ ] Use transaction wrapper for all operations
- [ ] Implement proper rollback on any failure
- [ ] Return error if ANY operation fails (don't silently ignore)
- [ ] Test fallback path thoroughly

**Risk if not fixed:** Data inconsistency grows with each failed operation

---

### 4. Stock Calculation Formula Mismatch (CRITICAL)
**Location:** Multiple files
**Problem:**
- `fix-inventory-stock.js` uses: `correctStock = initialStock + totalAdded - totalDistributed - totalCentralSold - totalWithdrawn`
- But `api/inventory/index.js` only calculates: `total_allocated` and `total_added`
- Stock withdrawals table exists but is never deducted from current_stock in API
- The `current_stock` field is updated by triggers but doesn't account for all deductions

**Impact:** Inventory reports show incorrect available stock
**Example:** 100 units initial, 20 withdrawn, but system shows 100 available

**Fix Required:**
- [ ] Standardize stock calculation across all files
- [ ] Include withdrawals in current_stock calculation
- [ ] Add migration to recalculate all current_stock values
- [ ] Document the formula clearly

**Risk if not fixed:** All inventory reports are unreliable

---

### 5. Missing Validation for Negative Stock (CRITICAL)
**Location:** Database schema + API endpoints
**Problem:**
- No validation that `quantity_added` is positive
- No check that current_stock doesn't go negative
- Database has no CHECK constraint on current_stock >= 0
- Negative quantities could be inserted

**Impact:** Inventory can have negative stock values, breaking all calculations
**Example:** Add -50 units → current_stock becomes negative

**Fix Required:**
- [ ] Add CHECK constraint: `ALTER TABLE items ADD CONSTRAINT check_current_stock_positive CHECK (current_stock >= 0);`
- [ ] Add CHECK constraint: `ALTER TABLE stock_additions ADD CONSTRAINT check_quantity_positive CHECK (quantity_added > 0);`
- [ ] Add CHECK constraint: `ALTER TABLE stock_distribution ADD CONSTRAINT check_quantity_positive CHECK (quantity_allocated > 0);`
- [ ] Add CHECK constraint: `ALTER TABLE sales ADD CONSTRAINT check_quantity_positive CHECK (quantity_sold > 0);`
- [ ] Add validation in all API endpoints

**Risk if not fixed:** Invalid data corrupts entire system

---

## 🟠 HIGH SEVERITY ISSUES

### 6. Pagination Bug in Inventory Listing
**Location:** `api/inventory/index.js` (lines 50-60)
**Problem:**
- Total count is calculated from `processedItems.length` which is the page size, not total items
- `pagination.total` will always equal the page limit (default 50)
- `pagination.pages` calculation is wrong: `Math.ceil(50 / 50) = 1` always
- Clients can't know how many items exist or navigate properly

**Impact:** UI pagination broken, users can't see all inventory items
**Data Visibility:** Critical data becomes inaccessible

**Fix Required:**
- [ ] Get total count from database before pagination
- [ ] Use separate query: `SELECT COUNT(*) FROM items WHERE ...`
- [ ] Return correct pagination metadata

---

### 7. Concurrent Stock Addition Race Condition
**Location:** `api/inventory/stock.js`
**Problem:**
- Stock addition record inserted before stock update
- If stock update fails, addition record exists but stock wasn't updated
- Two concurrent additions can both read the same current_stock, then both add to it
- Example: current_stock = 100, two requests add 50 each, both read 100, both update to 150 (should be 200)

**Impact:** Stock additions lost, inventory undercount
**Frequency:** High in multi-user scenarios

**Fix Required:**
- [ ] Use atomic RPC function for stock additions (like sales)
- [ ] Add row-level locking with `FOR UPDATE`
- [ ] Wrap in transaction

---

### 8. No Validation of Stall Existence in Sales
**Location:** `api/sales/create.js`
**Problem:**
- User's stall_id is used without verifying the stall exists or is active
- If stall is deleted or deactivated, sales still record to non-existent stall
- Foreign key constraint exists but only prevents deletion, not validation

**Impact:** Sales recorded to invalid stalls, data integrity issues
**Orphaned Data:** Sales with stall_id pointing to deleted stalls

**Fix Required:**
- [ ] Add validation: `SELECT * FROM stalls WHERE stall_id = ? AND status = 'active'`
- [ ] Return error if stall not found or inactive
- [ ] Already implemented in `distribute_stock_atomic` function - apply same pattern

---

### 9. Credit Sales Payment Status Not Updated
**Location:** `api/sales/create.js` and database schema
**Problem:**
- Credit sales created with `payment_status = 'unpaid'`
- No API endpoint to update payment status or amount_paid
- `balance_due` is calculated but never updated when payments received
- No way to mark credit sales as paid

**Impact:** Credit tracking broken, can't reconcile payments
**Data Inconsistency:** Payment records don't match actual payments received

**Fix Required:**
- [ ] Create endpoint: `PATCH /api/sales/:sale_id/payment`
- [ ] Update `payment_status` and `amount_paid` fields
- [ ] Recalculate `balance_due`
- [ ] Add validation: `amount_paid <= total_credit_amount`
- [ ] Add audit logging for payment updates

---

### 10. Trigger Double-Execution Risk
**Location:** `init.sql` + `add-atomic-transactions.sql`
**Problem:**
- `trigger_update_current_stock` fires AFTER INSERT on sales
- But `create_sale_atomic` function ALSO updates current_stock
- If both execute, stock decremented twice
- Trigger is disabled in add-atomic-transactions.sql but this might not be applied consistently

**Impact:** Stock corruption, inconsistent behavior depending on which code path executes
**Unpredictability:** Same operation produces different results

**Fix Required:**
- [ ] Permanently remove trigger from init.sql
- [ ] Ensure all stock updates go through atomic functions
- [ ] Add comment explaining why trigger was removed

---

### 11. No Constraint on Quantity Fields
**Location:** Database schema (init.sql)
**Problem:**
- `quantity_sold`, `quantity_allocated`, `quantity_added`, `quantity_withdrawn` have no CHECK constraints
- Negative quantities can be inserted
- Zero quantities can be inserted (meaningless records)
- No maximum limits

**Impact:** Invalid data in database, calculations break
**Example:** Insert sale with quantity_sold = -100 → stock increases instead of decreases

**Fix Required:**
- [ ] Add CHECK constraints on all quantity fields: `CHECK (quantity > 0)`
- [ ] Add validation in all API endpoints
- [ ] Audit existing data for invalid quantities

---

## 🟡 MEDIUM SEVERITY ISSUES

### 12. Inconsistent Error Handling in Fallback Path
**Location:** `api/sales/create.js` (lines 85-100)
**Problem:**
- Credit sales error is logged but ignored
- Stock update error is logged but ignored
- Client receives 201 success even if critical operations failed
- No indication to user that data is incomplete

**Impact:** Silent failures, users don't know data wasn't saved properly
**Data Loss:** Operations fail silently, users think they succeeded

**Fix Required:**
- [ ] Return error if credit_sales insert fails
- [ ] Return error if stock update fails
- [ ] Implement proper transaction rollback
- [ ] Add error logging with context

---

### 13. Missing Indexes on Foreign Keys
**Location:** `init.sql`
**Problem:**
- No indexes on `item_id` in sales, stock_distribution, stock_additions tables
- No indexes on `stall_id` in sales, stock_distribution tables
- Queries filtering by these fields will do full table scans
- Performance degrades with large datasets

**Impact:** Slow queries, potential timeout issues
**Cascading:** Slow queries can cause race conditions to be more likely

**Fix Required:**
- [ ] Create indexes:
  ```sql
  CREATE INDEX idx_sales_item_id ON sales(item_id);
  CREATE INDEX idx_sales_stall_id ON sales(stall_id);
  CREATE INDEX idx_stock_distribution_item_id ON stock_distribution(item_id);
  CREATE INDEX idx_stock_distribution_stall_id ON stock_distribution(stall_id);
  CREATE INDEX idx_stock_additions_item_id ON stock_additions(item_id);
  ```

---

### 14. Activity Log Doesn't Capture All Changes
**Location:** `init.sql` (lines 135-150)
**Problem:**
- Trigger tries to extract user_id from multiple columns: `COALESCE(NEW.created_by, NEW.recorded_by, NEW.added_by, NEW.distributed_by)`
- If none exist, user_id is NULL - no audit trail
- Doesn't log who made the change for stock_additions, stock_distribution, stock_withdrawals
- Activity log can't be used for accountability

**Impact:** No audit trail for critical operations
**Compliance:** Can't track who made changes

**Fix Required:**
- [ ] Standardize user tracking column names across all tables
- [ ] Add triggers for stock_additions, stock_distribution, stock_withdrawals
- [ ] Ensure user_id is always captured
- [ ] Add validation that user_id is not NULL

---

### 15. No Validation of Quantity Relationships
**Location:** Multiple endpoints
**Problem:**
- No check that `quantity_sold` doesn't exceed `quantity_allocated` for stall sales
- No check that total distributions don't exceed current_stock
- No check that withdrawals don't exceed current_stock
- Stall can sell items that weren't distributed to them

**Impact:** Stalls can sell inventory they don't have
**Business Logic:** Breaks inventory allocation system

**Fix Required:**
- [ ] Add validation in sales endpoint: `quantity_sold <= quantity_allocated_to_stall`
- [ ] Add validation in distribution endpoint: `total_distributed <= current_stock`
- [ ] Add validation in withdrawal endpoint: `quantity_withdrawn <= current_stock`
- [ ] Add business logic tests

---

## 📋 PRIORITY FIX ORDER

### Phase 1: CRITICAL (Do First - This Week)
1. ✅ Fix Total Received calculation (DONE - commit 269b516)
2. [ ] Remove double stock deduction (Issue #1)
3. [ ] Add row-level locking to distribution (Issue #2)
4. [ ] Implement proper transaction handling (Issue #3)
5. [ ] Add CHECK constraints for negative stock (Issue #5)

### Phase 2: HIGH (Do Next - Next Week)
6. [ ] Fix pagination bug (Issue #6)
7. [ ] Fix stock addition race condition (Issue #7)
8. [ ] Add stall validation (Issue #8)
9. [ ] Create payment update endpoint (Issue #9)
10. [ ] Remove trigger double-execution (Issue #10)
11. [ ] Add quantity constraints (Issue #11)

### Phase 3: MEDIUM (Do After - Following Week)
12. [ ] Improve error handling (Issue #12)
13. [ ] Add missing indexes (Issue #13)
14. [ ] Improve audit logging (Issue #14)
15. [ ] Add quantity relationship validation (Issue #15)

---

## Testing Checklist

Before deploying any fixes:
- [ ] Unit tests for each fix
- [ ] Integration tests for transaction handling
- [ ] Concurrent operation tests (simulate multiple users)
- [ ] Data validation tests (negative values, zero values, etc.)
- [ ] Rollback tests (ensure transactions rollback on failure)
- [ ] Audit trail tests (verify all changes are logged)
- [ ] Performance tests (verify indexes improve query speed)

---

## Data Backup Recommendation

**CRITICAL:** Before implementing any fixes, create a full database backup:
```bash
# Backup Supabase database
pg_dump postgresql://user:password@db.supabase.co:5432/postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Backup Schedule:**
- Daily automated backups (configure in Supabase)
- Weekly manual backups before major changes
- Backup before deploying any of these fixes

---

## Questions for Admin

1. How many concurrent users typically use the system?
2. What is the typical daily transaction volume?
3. Are there any known data discrepancies currently?
4. When was the last full database backup?
5. What is the acceptable downtime for implementing fixes?

---

## Next Steps

1. Review this document with the development team
2. Prioritize fixes based on business impact
3. Create database backup
4. Implement Phase 1 fixes
5. Run comprehensive tests
6. Deploy to production
7. Monitor for data consistency issues
8. Implement Phase 2 and 3 fixes

---

**Document prepared:** May 18, 2026
**Prepared by:** Kiro AI Assistant
**Status:** READY FOR REVIEW
