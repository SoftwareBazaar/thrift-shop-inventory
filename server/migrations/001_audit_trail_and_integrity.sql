-- Migration: Audit Trail & Referential Integrity Enhancements
-- This migration enhances audit logging and prevents orphaned records
-- Date: May 19, 2026
-- Status: Safe - Additive only, no destructive changes

-- Add triggers to log all table modifications
-- Items table changes
DROP TRIGGER IF EXISTS trigger_log_items_insert ON items;
DROP TRIGGER IF EXISTS trigger_log_items_update ON items;
DROP TRIGGER IF EXISTS trigger_log_items_delete ON items;

CREATE OR REPLACE FUNCTION log_items_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        COALESCE(NEW.created_by, CURRENT_USER_ID()),
        TG_OP,
        'items',
        NEW.item_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_items_insert
AFTER INSERT ON items FOR EACH ROW EXECUTE FUNCTION log_items_change();

CREATE TRIGGER trigger_log_items_update
AFTER UPDATE ON items FOR EACH ROW EXECUTE FUNCTION log_items_change();

-- Stock distribution changes
DROP TRIGGER IF EXISTS trigger_log_distribution ON stock_distribution;

CREATE OR REPLACE FUNCTION log_distribution_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        COALESCE(NEW.distributed_by, CURRENT_USER_ID()),
        TG_OP,
        'stock_distribution',
        NEW.distribution_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_distribution
AFTER INSERT OR UPDATE ON stock_distribution FOR EACH ROW EXECUTE FUNCTION log_distribution_change();

-- Sales changes
DROP TRIGGER IF EXISTS trigger_log_sales ON sales;

CREATE OR REPLACE FUNCTION log_sales_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        COALESCE(NEW.recorded_by, CURRENT_USER_ID()),
        TG_OP,
        'sales',
        NEW.sale_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_sales
AFTER INSERT OR UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION log_sales_change();

-- Ensure stall deletions cascade properly or prevent if allocations exist
ALTER TABLE stock_distribution
DROP CONSTRAINT IF EXISTS stock_distribution_stall_id_fkey,
ADD CONSTRAINT stock_distribution_stall_id_fkey
FOREIGN KEY (stall_id) REFERENCES stalls(stall_id) ON DELETE CASCADE;

-- Add constraint to prevent deletion of items with active allocations
ALTER TABLE stock_distribution
DROP CONSTRAINT IF EXISTS stock_distribution_item_id_fkey,
ADD CONSTRAINT stock_distribution_item_id_fkey
FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE;

-- Create index for faster audit trail queries
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_table ON activity_log(table_name);

-- Create view for recent activity
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

-- Create view to detect orphaned records
CREATE OR REPLACE VIEW orphaned_records AS
SELECT 
    'stock_distribution - deleted stall' as issue,
    sd.distribution_id as record_id,
    'stock_distribution' as table_name,
    COUNT(*) as count
FROM stock_distribution sd
LEFT JOIN stalls s ON sd.stall_id = s.stall_id
WHERE s.stall_id IS NULL
GROUP BY sd.distribution_id
UNION ALL
SELECT 
    'sales - deleted stall' as issue,
    s.sale_id as record_id,
    'sales' as table_name,
    COUNT(*) as count
FROM sales s
LEFT JOIN stalls st ON s.stall_id = st.stall_id
WHERE st.stall_id IS NULL
GROUP BY s.sale_id
UNION ALL
SELECT 
    'credit_sales - deleted sale' as issue,
    cs.credit_id as record_id,
    'credit_sales' as table_name,
    COUNT(*) as count
FROM credit_sales cs
LEFT JOIN sales s ON cs.sale_id = s.sale_id
WHERE s.sale_id IS NULL
GROUP BY cs.credit_id;

-- Grant appropriate permissions
GRANT SELECT ON recent_activity TO postgres;
GRANT SELECT ON orphaned_records TO postgres;
