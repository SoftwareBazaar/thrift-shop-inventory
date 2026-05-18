# Admin Checklist - Data Integrity & Backup

**Last Updated:** May 18, 2026
**Frequency:** Daily, Weekly, Monthly
**Owner:** System Administrator

---

## 🔴 IMMEDIATE ACTIONS (This Week)

### [ ] 1. Create Database Backup
- [ ] Go to Supabase Dashboard
- [ ] Navigate to Database → Backups
- [ ] Download the latest backup
- [ ] Save as: `backup_20260518.sql`
- [ ] Store in secure location
- [ ] Verify file size > 1MB
- [ ] Document backup location

**Time Required:** 15 minutes
**Importance:** CRITICAL

### [ ] 2. Review Data Integrity Issues
- [ ] Read: ANALYSIS_SUMMARY.md
- [ ] Read: CRITICAL_FIXES_REQUIRED.md
- [ ] Understand the 5 critical issues
- [ ] Share with development team
- [ ] Schedule implementation meeting

**Time Required:** 30 minutes
**Importance:** CRITICAL

### [ ] 3. Verify Current Data
- [ ] Check for negative stock values
- [ ] Verify Total Received = At Stalls + Sold (all products)
- [ ] Look for any orphaned records
- [ ] Document any discrepancies

**Time Required:** 30 minutes
**Importance:** HIGH

---

## 📅 DAILY CHECKLIST (Every Day)

### Morning (5 minutes)
- [ ] Check system is running
- [ ] Look for any error messages
- [ ] Verify no negative stock values
- [ ] Check for failed transactions in logs

### Evening (5 minutes)
- [ ] Reconcile daily sales
- [ ] Verify all distributions completed
- [ ] Check for any discrepancies
- [ ] Document any issues

### If Issues Found
- [ ] Document the issue (what, when, how much)
- [ ] Take screenshot
- [ ] Note exact error message
- [ ] Report to development team
- [ ] Do NOT manually edit database

---

## 📊 WEEKLY CHECKLIST (Every Monday)

### [ ] 1. Inventory Reconciliation (30 minutes)
- [ ] Run inventory reconciliation report
- [ ] For each product, verify: Total Received = At Stalls + Sold
- [ ] Check for any negative stock values
- [ ] Look for orphaned records
- [ ] Compare with previous week

### [ ] 2. Sales & Distribution Review (20 minutes)
- [ ] Review all sales from past week
- [ ] Verify all distributions are accounted for
- [ ] Check for any failed transactions
- [ ] Verify credit sales are tracked

### [ ] 3. Data Consistency Check (15 minutes)
- [ ] Run SQL queries to check for:
  - Negative stock values
  - Orphaned sales records
  - Orphaned distribution records
  - Invalid stall references

### [ ] 4. Performance Check (10 minutes)
- [ ] Check system response time
- [ ] Look for slow queries
- [ ] Monitor database size
- [ ] Check for any performance issues

### [ ] 5. Documentation (5 minutes)
- [ ] Document findings
- [ ] Note any issues
- [ ] Update issue log
- [ ] Share with team if needed

**Total Time:** ~1.5 hours
**Best Time:** Monday morning

---

## 💾 MONTHLY CHECKLIST (1st of Month)

### [ ] 1. Database Backup (20 minutes)
- [ ] Go to Supabase Dashboard
- [ ] Download latest backup
- [ ] Save as: `backup_YYYYMM01.sql`
- [ ] Verify file integrity
- [ ] Store in secure location
- [ ] Update backup log

### [ ] 2. Backup Verification (15 minutes)
- [ ] Check backup file size
- [ ] Verify backup is not corrupted
- [ ] Test restore to test database (if possible)
- [ ] Document backup location

### [ ] 3. Full Inventory Reconciliation (1 hour)
- [ ] Run complete inventory report
- [ ] Verify all products
- [ ] Check for discrepancies
- [ ] Compare with physical count (if available)
- [ ] Document findings

### [ ] 4. Data Integrity Audit (30 minutes)
- [ ] Check for negative stock values
- [ ] Look for orphaned records
- [ ] Verify all transactions completed
- [ ] Check audit trail for completeness
- [ ] Review failed transactions

### [ ] 5. System Health Check (20 minutes)
- [ ] Check database size
- [ ] Monitor performance metrics
- [ ] Review error logs
- [ ] Check for any warnings
- [ ] Document system health

### [ ] 6. Team Communication (10 minutes)
- [ ] Share backup completion with team
- [ ] Report any issues found
- [ ] Discuss any needed fixes
- [ ] Update documentation

### [ ] 7. Backup Reminder (5 minutes)
- [ ] Trigger backup reminder hook
- [ ] Follow the comprehensive checklist
- [ ] Confirm all steps completed
- [ ] Document in backup log

**Total Time:** ~2.5 hours
**Best Time:** 1st of month, morning

---

## 🚨 INCIDENT RESPONSE CHECKLIST

### If Negative Stock Detected
- [ ] STOP all operations on affected item
- [ ] Document the negative value
- [ ] Note when it was discovered
- [ ] Take screenshot
- [ ] Notify admin immediately
- [ ] Investigate recent sales/distributions
- [ ] Check if backup restore needed
- [ ] Report to development team
- [ ] Do NOT manually edit database

### If Data Discrepancy Found
- [ ] Document the discrepancy
- [ ] Verify using multiple sources
- [ ] Notify admin and development team
- [ ] Do NOT manually edit database
- [ ] Wait for guidance
- [ ] Create backup before any corrections
- [ ] Document resolution

### If Transaction Fails
- [ ] Note error message and timestamp
- [ ] Verify operation didn't partially complete
- [ ] Retry if safe to do so
- [ ] Report if retry fails
- [ ] Document in incident log
- [ ] Notify admin

### If System Slow/Unresponsive
- [ ] Check database connection
- [ ] Monitor system resources
- [ ] Check for long-running queries
- [ ] Restart if necessary
- [ ] Document issue
- [ ] Report to development team

---

## 📋 VERIFICATION QUERIES

### Check for Negative Stock
```sql
SELECT item_id, item_name, current_stock 
FROM items 
WHERE current_stock < 0;
-- Should return: 0 rows
```

### Check for Orphaned Sales
```sql
SELECT s.sale_id, s.item_id 
FROM sales s 
LEFT JOIN items i ON s.item_id = i.item_id 
WHERE i.item_id IS NULL;
-- Should return: 0 rows
```

### Check Total Received Consistency
```sql
SELECT 
  i.item_id,
  i.item_name,
  COALESCE(SUM(sd.quantity_allocated), 0) as at_stalls,
  COALESCE(SUM(s.quantity_sold), 0) as sold,
  COALESCE(SUM(sd.quantity_allocated), 0) + COALESCE(SUM(s.quantity_sold), 0) as total_received
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
LEFT JOIN sales s ON i.item_id = s.item_id
GROUP BY i.item_id, i.item_name
ORDER BY i.item_id;
```

### Check for Invalid Quantities
```sql
SELECT * FROM sales WHERE quantity_sold <= 0;
SELECT * FROM stock_distribution WHERE quantity_allocated <= 0;
SELECT * FROM stock_additions WHERE quantity_added <= 0;
-- All should return: 0 rows
```

---

## 📞 ESCALATION CONTACTS

### For Data Issues
1. **First:** Check this checklist
2. **Second:** Review DATA_INTEGRITY_ISSUES.md
3. **Third:** Contact development team

### Development Team
- **Email:** [development team email]
- **Slack:** #inventory-issues
- **Emergency:** [emergency contact]

### Backup Support
- **Supabase Support:** support@supabase.io
- **Documentation:** https://supabase.com/docs

---

## 📝 BACKUP LOG

### Template for Monthly Backups
```
Date: [YYYY-MM-DD]
Backup File: backup_YYYYMMDD.sql
File Size: [size in MB]
Location: [where stored]
Verified: [Yes/No]
Issues Found: [none/list issues]
Notes: [any additional notes]
Completed By: [admin name]
```

### Example Entry
```
Date: 2026-05-18
Backup File: backup_20260518.sql
File Size: 2.5 MB
Location: External drive + Google Drive
Verified: Yes
Issues Found: None
Notes: All systems normal
Completed By: Admin Name
```

---

## ✅ SIGN-OFF

### Daily Checklist
- [ ] Completed by: ________________
- [ ] Date: ________________
- [ ] Issues found: ________________

### Weekly Checklist
- [ ] Completed by: ________________
- [ ] Date: ________________
- [ ] Issues found: ________________

### Monthly Checklist
- [ ] Completed by: ________________
- [ ] Date: ________________
- [ ] Issues found: ________________
- [ ] Backup verified: ________________

---

## 📚 REFERENCE DOCUMENTS

- **ANALYSIS_SUMMARY.md** - Overview of all findings
- **DATA_INTEGRITY_ISSUES.md** - Detailed analysis of 15 issues
- **CRITICAL_FIXES_REQUIRED.md** - Implementation guide for urgent fixes
- **data-integrity-guidelines.md** - Safe operating procedures
- **backup-reminder.json** - Monthly backup reminder hook

---

## 🎯 KEY METRICS TO TRACK

### Daily
- [ ] Number of failed transactions
- [ ] Number of negative stock items
- [ ] System uptime percentage

### Weekly
- [ ] Total inventory value
- [ ] Stock discrepancies
- [ ] Failed transaction count

### Monthly
- [ ] Backup completion status
- [ ] Data integrity score
- [ ] System health score

---

**Last Updated:** May 18, 2026
**Next Review:** May 25, 2026
**Status:** ACTIVE - FOLLOW DAILY
