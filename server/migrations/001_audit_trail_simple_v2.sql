-- ============================================================================
-- MIGRATION 001: AUDIT TRAIL & ACTIVITY LOGGING
-- ============================================================================
-- Status: ✅ SAFE - Additive only, no data deletion
-- What it does: Tracks all changes to critical tables (who changed what when)
-- Created: May 19, 2026
-- ============================================================================

-- Step 1: Create activity log table (if not exists)
-- This table records all changes to critical tables
CREATE TABLE IF NOT EXISTS activity_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_table ON activity_log(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_record_id ON activity_log(record_id);

-- Step 3: Create view for recent activity (last 500 entries)
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    al.log_id,
    al.user_id,
    u.username,
    al.action,
    al.table_name,
    al.record_id,
    al.timestamp
FROM activity_log al
LEFT JOIN users u ON al.user_id = u.user_id
ORDER BY al.timestamp DESC
LIMIT 500;

-- Step 4: Create view to detect orphaned records
-- This view finds any records whose foreign key references have been deleted
CREATE OR REPLACE VIEW orphaned_records AS
SELECT 
    'stock_distribution_no_stall' as issue_type,
    sd.distribution_id as record_id,
    'stock_distribution' as table_name,
    COUNT(*) as count
FROM stock_distribution sd
LEFT JOIN stalls s ON sd.stall_id = s.stall_id
WHERE s.stall_id IS NULL
GROUP BY sd.distribution_id

UNION ALL

SELECT 
    'sales_no_stall' as issue_type,
    s.sale_id as record_id,
    'sales' as table_name,
    COUNT(*) as count
FROM sales s
LEFT JOIN stalls st ON s.stall_id = st.stall_id
WHERE st.stall_id IS NULL
GROUP BY s.sale_id

UNION ALL

SELECT 
    'credit_sales_no_sale' as issue_type,
    cs.credit_id as record_id,
    'credit_sales' as table_name,
    COUNT(*) as count
FROM credit_sales cs
LEFT JOIN sales s ON cs.sale_id = s.sale_id
WHERE s.sale_id IS NULL
GROUP BY cs.credit_id

UNION ALL

SELECT 
    'stock_distribution_no_item' as issue_type,
    sd.distribution_id as record_id,
    'stock_distribution' as table_name,
    COUNT(*) as count
FROM stock_distribution sd
LEFT JOIN items i ON sd.item_id = i.item_id
WHERE i.item_id IS NULL
GROUP BY sd.distribution_id;

-- Step 5: Create trigger function for items table
CREATE OR REPLACE FUNCTION log_items_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values, timestamp)
    VALUES (
        COALESCE(NEW.created_by, NULL),
        TG_OP,
        'items',
        NEW.item_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create triggers for items table
DROP TRIGGER IF EXISTS trig_items_audit ON items;
CREATE TRIGGER trig_items_audit
AFTER INSERT OR UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION log_items_changes();

-- Step 7: Create trigger function for stock_distribution table
CREATE OR REPLACE FUNCTION log_stock_distribution_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values, timestamp)
    VALUES (
        COALESCE(NEW.distributed_by, NULL),
        TG_OP,
        'stock_distribution',
        NEW.distribution_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create triggers for stock_distribution table
DROP TRIGGER IF EXISTS trig_stock_distribution_audit ON stock_distribution;
CREATE TRIGGER trig_stock_distribution_audit
AFTER INSERT OR UPDATE ON stock_distribution
FOR EACH ROW EXECUTE FUNCTION log_stock_distribution_changes();

-- Step 9: Create trigger function for sales table
CREATE OR REPLACE FUNCTION log_sales_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values, timestamp)
    VALUES (
        COALESCE(NEW.recorded_by, NULL),
        TG_OP,
        'sales',
        NEW.sale_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create triggers for sales table
DROP TRIGGER IF EXISTS trig_sales_audit ON sales;
CREATE TRIGGER trig_sales_audit
AFTER INSERT OR UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION log_sales_changes();

-- Step 11: Create trigger function for stock_additions table
CREATE OR REPLACE FUNCTION log_stock_additions_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values, timestamp)
    VALUES (
        COALESCE(NEW.added_by, NULL),
        TG_OP,
        'stock_additions',
        NEW.addition_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create triggers for stock_additions table
DROP TRIGGER IF EXISTS trig_stock_additions_audit ON stock_additions;
CREATE TRIGGER trig_stock_additions_audit
AFTER INSERT OR UPDATE ON stock_additions
FOR EACH ROW EXECUTE FUNCTION log_stock_additions_changes();

-- Step 13: Create view for audit summary by user
CREATE OR REPLACE VIEW audit_summary_by_user AS
SELECT 
    al.user_id,
    u.username,
    COUNT(*) as total_changes,
    COUNT(CASE WHEN al.action = 'INSERT' THEN 1 END) as inserts,
    COUNT(CASE WHEN al.action = 'UPDATE' THEN 1 END) as updates,
    MAX(al.timestamp) as last_action_time
FROM activity_log al
LEFT JOIN users u ON al.user_id = u.user_id
GROUP BY al.user_id, u.username
ORDER BY total_changes DESC;

-- Step 14: Create view for audit summary by table
CREATE OR REPLACE VIEW audit_summary_by_table AS
SELECT 
    al.table_name,
    COUNT(*) as total_changes,
    COUNT(CASE WHEN al.action = 'INSERT' THEN 1 END) as inserts,
    COUNT(CASE WHEN al.action = 'UPDATE' THEN 1 END) as updates,
    MAX(al.timestamp) as last_change_time
FROM activity_log al
WHERE al.table_name IS NOT NULL
GROUP BY al.table_name
ORDER BY total_changes DESC;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify migration worked)
-- ============================================================================
-- SELECT COUNT(*) FROM activity_log;                    -- Should exist
-- SELECT * FROM recent_activity LIMIT 5;               -- Should show recent changes
-- SELECT * FROM orphaned_records;                       -- Should show any orphaned data
-- SELECT * FROM audit_summary_by_user;                  -- Should show activity by user
-- SELECT * FROM audit_summary_by_table;                 -- Should show activity by table
-- ============================================================================

-- ✅ MIGRATION 001 COMPLETE
-- All audit logging is now active and tracking changes to critical tables
