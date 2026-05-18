---
inclusion: manual
---

# Data Integrity Guidelines - Thrift Shop Inventory System

**Last Updated:** May 18, 2026
**Critical Status:** ⚠️ KNOWN ISSUES IDENTIFIED

## Overview

This document outlines critical data integrity issues in the Thrift Shop inventory system and guidelines for safe operations until fixes are implemented.

## Known Critical Issues

### 1. Stock Calculation Inconsistencies
**Status:** IDENTIFIED - FIX IN PROGRESS
- **Issue:** Total Received calculation was using historical values instead of actual inventory
- **Fix Applied:** Changed formula to `Total Received = At Stalls (Unsold) + Sold`
- **Commit:** 269b516
- **Impact:** All inventory reports now show correct totals

### 2. Potential Double Stock Deduction
**Status:** IDENTIFIED - AWAITING FIX
- **Issue:** Sales may decrement stock twice due to overlapping triggers and API calls
- **Risk Level:** HIGH
- **Workaround:** Monitor stock levels closely after each sale
- **Action Required:** See DATA_INTEGRITY_ISSUES.md for fix details

### 3. Race Conditions in Concurrent Operations
**Status:** IDENTIFIED - AWAITING FIX
- **Issue:** Multiple simultaneous distributions or stock additions may cause negative stock
- **Risk Level:** HIGH
- **Workaround:** Avoid simultaneous operations on same item
- **Action Required:** Implement row-level locking (see DATA_INTEGRITY_ISSUES.md)

### 4. Incomplete Transaction Handling
**Status:** IDENTIFIED - AWAITING FIX
- **Issue:** Failed operations may leave partial data in database
- **Risk Level:** CRITICAL
- **Workaround:** Verify all operations completed successfully
- **Action Required:** Implement proper transaction rollback (see DATA_INTEGRITY_ISSUES.md)

## Safe Operating Procedures

### Before Each Day
- [ ] Verify no negative stock values exist
- [ ] Check for any failed transactions in logs
- [ ] Review previous day's sales and distributions

### During Operations
- [ ] Avoid simultaneous operations on the same item
- [ ] Wait for one operation to complete before starting another
- [ ] Monitor for error messages or warnings
- [ ] Do not force-close the application during transactions

### After Each Day
- [ ] Reconcile inventory totals
- [ ] Verify: Total Received = At Stalls + Sold (for all products)
- [ ] Check for any orphaned records
- [ ] Document any discrepancies

### Weekly
- [ ] Run full inventory reconciliation report
- [ ] Compare system totals with physical count
- [ ] Review all failed transactions
- [ ] Check for negative stock values
- [ ] Verify all distributions are accounted for

### Monthly
- [ ] Download database backup (CRITICAL)
- [ ] Verify backup integrity
- [ ] Store backup in secure location
- [ ] Document backup location
- [ ] Review all data integrity issues
- [ ] Plan fixes for identified issues

## Verification Checklist

### Stock Consistency Check
For each product, verify:
```
Total Received = At Stalls (Unsold) + Sold

Example:
- At Stalls: 43
- Sold: 86
- Total Received: 129 ✓ (43 + 86 = 129)
```

### Negative Stock Check
```sql
-- Run this query to check for negative stock
SELECT item_id, item_name, current_stock 
FROM items 
WHERE current_stock < 0;

-- Should return: 0 rows
```

### Orphaned Records Check
```sql
-- Check for sales with non-existent items
SELECT s.sale_id, s.item_id 
FROM sales s 
LEFT JOIN items i ON s.item_id = i.item_id 
WHERE i.item_id IS NULL;

-- Should return: 0 rows
```

### Distribution Consistency Check
```sql
-- Verify total distributed doesn't exceed initial stock
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  COALESCE(SUM(sd.quantity_allocated), 0) as total_distributed,
  i.initial_stock - COALESCE(SUM(sd.quantity_allocated), 0) as remaining
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
GROUP BY i.item_id, i.item_name, i.initial_stock
HAVING i.initial_stock < COALESCE(SUM(sd.quantity_allocated), 0);

-- Should return: 0 rows
```

## Data Backup Procedures

### Automated Backups
- Supabase provides daily automated backups
- Backups are retained for 7 days
- Access via Supabase Dashboard → Database → Backups

### Manual Backup (Monthly - REQUIRED)
```bash
# Download backup from Supabase
# 1. Go to Supabase Dashboard
# 2. Select your project
# 3. Go to Database → Backups
# 4. Click "Download" on the latest backup
# 5. Save to secure location with date: backup_YYYYMMDD.sql
```

### Backup Verification
```bash
# Verify backup file integrity
# Check file size is reasonable (should be > 1MB for production data)
# Try to restore to test database to verify it's not corrupted
```

### Backup Storage
- **Primary:** External hard drive (encrypted)
- **Secondary:** Cloud storage (Google Drive, OneDrive, etc.)
- **Tertiary:** Email archive (for critical backups)
- **Location Log:** Maintain document of all backup locations

## Incident Response

### If Negative Stock Detected
1. **STOP** all operations on affected item
2. **Document** the negative value and when it was discovered
3. **Notify** admin immediately
4. **Investigate** recent sales and distributions for that item
5. **Restore** from backup if necessary
6. **Report** to development team

### If Data Discrepancy Found
1. **Document** the discrepancy (what, when, how much)
2. **Verify** using multiple data sources
3. **Notify** admin and development team
4. **Do NOT** manually edit database
5. **Wait** for guidance from development team
6. **Create** backup before any corrections

### If Transaction Fails
1. **Note** the error message and timestamp
2. **Verify** the operation did not partially complete
3. **Retry** the operation if safe to do so
4. **Report** to admin if retry fails
5. **Document** in incident log

## Monitoring Dashboard

### Key Metrics to Monitor
- Total inventory value
- Stock discrepancies (Total Received vs actual)
- Failed transaction count
- Negative stock count
- Orphaned record count

### Daily Monitoring
- Check for any alerts or warnings
- Verify key metrics are within expected ranges
- Review error logs for anomalies

### Weekly Reporting
- Generate inventory reconciliation report
- Compare with previous week
- Identify trends or issues
- Document findings

## Contact & Escalation

### For Data Issues
1. **First:** Check DATA_INTEGRITY_ISSUES.md for known issues
2. **Second:** Review this document for procedures
3. **Third:** Contact development team with:
   - Exact error message
   - Timestamp of issue
   - Steps to reproduce
   - Screenshot/log excerpt

### Development Team
- **Email:** [development team email]
- **Slack:** #inventory-issues
- **Emergency:** [emergency contact]

## References

- **Full Issue Report:** DATA_INTEGRITY_ISSUES.md
- **Recent Fixes:** Commit 269b516 (Total Received calculation)
- **Backup Reminder:** Monthly hook configured
- **Database Schema:** init.sql
- **Atomic Functions:** add-atomic-transactions.sql

## Acknowledgments

- **Issue Identified:** May 18, 2026
- **Analysis Completed:** May 18, 2026
- **Fixes Planned:** In progress
- **Status:** ACTIVE MONITORING REQUIRED

---

**Last Updated:** May 18, 2026
**Next Review:** May 25, 2026
**Status:** CRITICAL - REQUIRES ATTENTION
