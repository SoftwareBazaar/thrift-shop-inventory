# Remaining Issues Report - May 18, 2026

**Status:** 🟢 5 Critical Bugs FIXED | 🔴 5 High Priority Bugs REMAINING | 🔴 56 Security Vulnerabilities REMAINING

---

## 📊 SUMMARY

### ✅ FIXED (5 Critical Bugs)
- ✅ Double Stock Deduction
- ✅ Race Condition in Distribution
- ✅ Incomplete Transaction Handling
- ✅ Stock Calculation Formula Mismatch
- ✅ Missing Negative Stock Validation

### 🔴 REMAINING (5 High Priority Bugs)
- 🔴 Missing Audit Trail for Stock Changes
- 🔴 Orphaned Distribution Records
- 🔴 Missing Validation for Stall Allocation
- 🔴 Incomplete Credit Sales Tracking
- 🔴 Missing Reconciliation Tools

### 🔴 REMAINING (5 Medium Priority Bugs)
- 🔴 Stock Withdrawal Reason Not Required (partially fixed)
- 🔴 No Expiration Date Tracking
- 🔴 No Batch/Lot Tracking
- 🔴 Incomplete Sales Report Filtering
- 🔴 No Inventory Variance Report

### 🔴 REMAINING (56 Security Vulnerabilities)
- 🔴 29 HIGH severity npm vulnerabilities
- 🔴 12 MODERATE severity npm vulnerabilities
- 🔴 15 LOW severity npm vulnerabilities

---

## 🔴 HIGH PRIORITY BUGS (Fix This Week)

### BUG #6: Missing Audit Trail for Stock Changes

**Problem:** No record of WHO made changes or WHEN

**Impact:** Cannot trace stock discrepancies to source

**Example:**
- Stock decreased by 50 units
- No way to know who did it or why
- Cannot investigate discrepancies

**How to Fix:**
1. Create `audit_logs` table with columns:
   - `log_id` (primary key)
   - `user_id` (who made the change)
   - `action` (what was changed: sale, distribution, withdrawal, etc.)
   - `item_id` (which item)
   - `quantity_changed` (how much)
   - `timestamp` (when)
   - `details` (JSON with additional info)

2. Add logging to all stock-changing endpoints:
   - `api/sales/create.js`
   - `api/inventory/distribute.js`
   - `api/inventory/stock.js`
   - `api/inventory/[id].js` (delete)

3. Create audit report endpoint:
   - `api/reports/audit.js`

**Estimated Time:** 3-4 hours

---

### BUG #7: Orphaned Distribution Records

**Problem:** If stall is deleted, distribution records remain

**Impact:** Phantom stock allocated to non-existent stalls

**Example:**
- Stall "Stall A" has 50 units allocated
- Stall "Stall A" is deleted
- 50 units still show as "allocated" but to a non-existent stall

**How to Fix:**
1. Add foreign key constraint with CASCADE DELETE:
   ```sql
   ALTER TABLE stock_distribution
   ADD CONSTRAINT fk_stall_id
   FOREIGN KEY (stall_id) REFERENCES stalls(stall_id)
   ON DELETE CASCADE;
   ```

2. Or soft-delete stalls instead of hard-delete:
   - Add `deleted_at` column to stalls table
   - Mark as deleted instead of removing

**Estimated Time:** 1-2 hours

---

### BUG #8: Missing Validation for Stall Allocation

**Problem:** Can allocate more than available stock

**Impact:** Negative stock at central hub

**Example:**
- Item has 100 units
- Allocate 60 to Stall A
- Allocate 60 to Stall B (should fail, only 40 left)
- But it succeeds → stock becomes -20

**How to Fix:**
1. Add CHECK constraint:
   ```sql
   ALTER TABLE stock_distribution
   ADD CONSTRAINT check_allocation_not_exceeds_stock
   CHECK (quantity_allocated > 0);
   ```

2. Add API validation in `api/inventory/distribute.js`:
   ```javascript
   if (quantity_allocated > item.current_stock) {
     return res.status(400).json({ 
       message: 'Cannot allocate more than available stock' 
     });
   }
   ```

**Estimated Time:** 1-2 hours

---

### BUG #9: Incomplete Credit Sales Tracking

**Problem:** Credit sales not properly linked to customers

**Impact:** Cannot track who owes money

**Example:**
- Create credit sale for 100,000 KES
- Customer name: "John"
- No way to track payment status or follow up

**How to Fix:**
1. Add fields to `credit_sales` table:
   - `payment_status` (unpaid, partial, paid)
   - `amount_paid` (how much has been paid)
   - `last_payment_date`
   - `notes` (payment notes)

2. Create payment tracking endpoint:
   - `api/sales/record-payment.js`

3. Create credit sales report:
   - `api/reports/credit-sales.js`

**Estimated Time:** 3-4 hours

---

### BUG #10: Missing Reconciliation Tools

**Problem:** No automated way to verify stock accuracy

**Impact:** Manual reconciliation is error-prone

**How to Fix:**
1. Create reconciliation endpoint:
   - `api/reports/reconciliation.js`

2. Compare:
   - Expected stock (initial + added - distributed - sold - withdrawn)
   - Actual stock (from database)
   - Discrepancies

3. Generate reconciliation report with:
   - Items with discrepancies
   - Magnitude of discrepancy
   - Possible causes

**Estimated Time:** 2-3 hours

---

## 🟡 MEDIUM PRIORITY BUGS (Fix Next Month)

### BUG #11: Stock Withdrawal Reason Not Required
- **Status:** Partially fixed (UI requires it, DB doesn't)
- **Fix:** Add NOT NULL constraint to `stock_withdrawals.reason`
- **Time:** 30 minutes

### BUG #12: No Expiration Date Tracking
- **Status:** Not fixed
- **Fix:** Add `expiration_date` column to items table
- **Time:** 2-3 hours

### BUG #13: No Batch/Lot Tracking
- **Status:** Not fixed
- **Fix:** Create `item_batches` table to track batches
- **Time:** 3-4 hours

### BUG #14: Incomplete Sales Report Filtering
- **Status:** Not fixed
- **Fix:** Add date range and stall filters to sales report
- **Time:** 2-3 hours

### BUG #15: No Inventory Variance Report
- **Status:** Not fixed
- **Fix:** Create variance report showing discrepancies
- **Time:** 2-3 hours

---

## 🔴 SECURITY VULNERABILITIES (56 Total)

### HIGH SEVERITY (29 Vulnerabilities)

**Critical Packages with Vulnerabilities:**
1. **Axios** (14 CVEs)
   - SSRF attacks
   - Prototype pollution
   - Authentication bypass
   - **Fix:** `npm install axios@latest`

2. **React Router** (1 CVE)
   - XSS via open redirects
   - **Fix:** `npm install react-router-dom@latest`

3. **Lodash** (3 CVEs)
   - Prototype pollution
   - Code injection
   - **Fix:** `npm install lodash@latest`

4. **Minimatch** (5 CVEs)
   - ReDoS attacks
   - **Fix:** `npm install minimatch@latest`

5. **Node-Forge** (7 CVEs)
   - Certificate validation bypass
   - Signature forgery
   - **Fix:** `npm install node-forge@latest`

6. **Webpack** (2 CVEs)
   - SSRF during build
   - **Fix:** `npm install webpack@latest`

7. **Other High Severity:**
   - Rollup, Serialize-JavaScript, Underscore, JSONPath, Path-to-Regexp, Picomatch, Fast-URI, Flatted, Glob

### MODERATE SEVERITY (12 Vulnerabilities)
- AJV, BN.js, Brace-Expansion, Follow-Redirects, JS-YAML, PostCSS, QS, Webpack-Dev-Server, WS, YAML, @Babel/Plugin-Transform-Modules-SystemJS, @Tootallnate/Once

### LOW SEVERITY (15 Vulnerabilities)
- Various dependencies with low-impact issues

---

## 🔧 SECURITY FIX STRATEGY

### Phase 1: Immediate (This Week)
```bash
npm install axios@latest
npm install react-router-dom@latest
npm install lodash@latest
npm install webpack@latest
npm install node-forge@latest
```

### Phase 2: Secondary (Next Week)
```bash
npm install minimatch@latest
npm install rollup@latest
npm install serialize-javascript@latest
npm install underscore@latest
npm install jsonpath@latest
```

### Phase 3: Remaining (Next 2 Weeks)
```bash
npm install path-to-regexp@latest
npm install picomatch@latest
npm install fast-uri@latest
npm install flatted@latest
npm install glob@latest
npm install postcss@latest
npm install qs@latest
npm install yaml@latest
npm install ws@latest
```

---

## 📋 WITHDRAWAL & DELETION HISTORY

To check withdrawal and deletion history, run this SQL in Supabase:

```sql
-- Check Stock Withdrawals History with Categories
SELECT 
  i.item_id,
  i.item_name,
  i.category,
  sw.quantity_withdrawn,
  sw.reason,
  sw.date_withdrawn
FROM stock_withdrawals sw
JOIN items i ON sw.item_id = i.item_id
ORDER BY sw.date_withdrawn DESC;

-- Summary by Category
SELECT 
  i.category,
  COUNT(sw.withdrawal_id) as total_withdrawals,
  SUM(sw.quantity_withdrawn) as total_quantity_withdrawn
FROM stock_withdrawals sw
JOIN items i ON sw.item_id = i.item_id
GROUP BY i.category;
```

---

## 📊 PRIORITY MATRIX

| Priority | Count | Time | Status |
|----------|-------|------|--------|
| Critical | 5 | 4-5 hrs | ✅ FIXED |
| High | 5 | 12-15 hrs | 🔴 TODO |
| Medium | 5 | 10-15 hrs | 🔴 TODO |
| Security | 56 | 8-10 hrs | 🔴 TODO |
| **TOTAL** | **71** | **34-45 hrs** | **🔴 IN PROGRESS** |

---

## 🎯 RECOMMENDED NEXT STEPS

### This Week
1. ✅ All 5 critical bugs fixed
2. ⏳ Fix Bug #6: Audit Trail (3-4 hours)
3. ⏳ Fix Bug #7: Orphaned Records (1-2 hours)
4. ⏳ Fix Bug #8: Stall Allocation (1-2 hours)

### Next Week
1. ⏳ Fix Bug #9: Credit Sales (3-4 hours)
2. ⏳ Fix Bug #10: Reconciliation (2-3 hours)
3. ⏳ Phase 1 Security Upgrades (2-3 hours)

### Next 2 Weeks
1. ⏳ Fix Medium Priority Bugs (10-15 hours)
2. ⏳ Phase 2 & 3 Security Upgrades (6-7 hours)

---

## 📞 SUPPORT

For withdrawal/deletion history:
1. Run the SQL queries in `check-withdrawals-and-deletions.sql`
2. Check the results for categories and dates
3. Contact development team if issues found

---

**Prepared:** May 18, 2026
**Status:** 5 Critical Bugs Fixed | 5 High Priority Remaining | 56 Security Vulnerabilities Remaining
**Next Review:** May 25, 2026

