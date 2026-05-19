-- Migration: Enhanced Tracking & Validation
-- Adds expiration date, batch tracking, and withdrawal validation
-- Date: May 19, 2026
-- Status: Safe - Additive only

-- Add columns to items for batch and expiration tracking
ALTER TABLE items
ADD COLUMN IF NOT EXISTS batch_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS expiration_date DATE,
ADD COLUMN IF NOT EXISTS requires_withdrawal_reason BOOLEAN DEFAULT TRUE;

-- Add columns to stock_additions for batch tracking
ALTER TABLE stock_additions
ADD COLUMN IF NOT EXISTS batch_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS expiration_date DATE,
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(100);

-- Enhance stock_distribution to track batch allocation
ALTER TABLE stock_distribution
ADD COLUMN IF NOT EXISTS batch_number VARCHAR(50);

-- Create stock_withdrawals table if it doesn't exist
CREATE TABLE IF NOT EXISTS stock_withdrawals (
    withdrawal_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    quantity_withdrawn INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    withdrawal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_by INTEGER REFERENCES users(user_id),
    notes TEXT,
    batch_number VARCHAR(50),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create function to validate withdrawal reasons
CREATE OR REPLACE FUNCTION validate_withdrawal_reason()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reason IS NULL OR TRIM(NEW.reason) = '' THEN
        RAISE EXCEPTION 'Withdrawal reason is required';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for withdrawal validation
DROP TRIGGER IF EXISTS trigger_validate_withdrawal_reason ON stock_withdrawals;
CREATE TRIGGER trigger_validate_withdrawal_reason
BEFORE INSERT OR UPDATE ON stock_withdrawals
FOR EACH ROW EXECUTE FUNCTION validate_withdrawal_reason();

-- Create function to validate expiration dates
CREATE OR REPLACE FUNCTION validate_expiration_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiration_date IS NOT NULL AND NEW.expiration_date < CURRENT_DATE THEN
        RAISE WARNING 'Stock added with expiration date in the past: %', NEW.expiration_date;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expiration date validation
DROP TRIGGER IF EXISTS trigger_validate_expiration ON stock_additions;
CREATE TRIGGER trigger_validate_expiration
BEFORE INSERT ON stock_additions
FOR EACH ROW EXECUTE FUNCTION validate_expiration_date();

-- Create view for expired stock
CREATE OR REPLACE VIEW expired_stock AS
SELECT 
    i.item_id,
    i.item_name,
    i.category,
    sa.batch_number,
    sa.expiration_date,
    sa.quantity_added as quantity_added,
    COALESCE(SUM(sd.quantity_allocated), 0) as allocated,
    sa.quantity_added - COALESCE(SUM(sd.quantity_allocated), 0) as available,
    DATE_PART('day', sa.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    CASE 
        WHEN sa.expiration_date < CURRENT_DATE THEN 'EXPIRED'
        WHEN sa.expiration_date < CURRENT_DATE + INTERVAL '7 days' THEN 'EXPIRING_SOON'
        WHEN sa.expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'MONITOR'
        ELSE 'OK'
    END as expiration_status
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id AND sa.batch_number = sd.batch_number
WHERE sa.expiration_date IS NOT NULL
GROUP BY i.item_id, i.item_name, i.category, sa.batch_number, sa.expiration_date, sa.quantity_added
ORDER BY sa.expiration_date ASC;

-- Create view for withdrawal tracking
CREATE OR REPLACE VIEW withdrawal_history AS
SELECT 
    sw.withdrawal_id,
    sw.item_id,
    i.item_name,
    sw.quantity_withdrawn,
    sw.reason,
    sw.withdrawal_date,
    u.username as withdrawn_by_user,
    sw.batch_number,
    sw.notes
FROM stock_withdrawals sw
LEFT JOIN items i ON sw.item_id = i.item_id
LEFT JOIN users u ON sw.withdrawn_by = u.user_id
ORDER BY sw.withdrawal_date DESC;

-- Create view for batch inventory
CREATE OR REPLACE VIEW batch_inventory AS
SELECT 
    i.item_id,
    i.item_name,
    sa.batch_number,
    sa.supplier_name,
    sa.expiration_date,
    sa.quantity_added,
    COALESCE(SUM(sd.quantity_allocated), 0) as allocated,
    COALESCE(SUM(s.quantity_sold), 0) as sold,
    sa.quantity_added - COALESCE(SUM(sd.quantity_allocated), 0) - COALESCE(SUM(s.quantity_sold), 0) as available,
    sa.date_added as added_date
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id AND sa.batch_number = sd.batch_number
LEFT JOIN sales s ON i.item_id = s.item_id
WHERE sa.batch_number IS NOT NULL
GROUP BY i.item_id, i.item_name, sa.batch_number, sa.supplier_name, sa.expiration_date, sa.quantity_added, sa.date_added
ORDER BY sa.expiration_date ASC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_additions_batch ON stock_additions(batch_number);
CREATE INDEX IF NOT EXISTS idx_stock_additions_expiration ON stock_additions(expiration_date);
CREATE INDEX IF NOT EXISTS idx_items_expiration ON items(expiration_date);
CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_reason ON stock_withdrawals(reason);
CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_date ON stock_withdrawals(withdrawal_date);

-- Create audit function for batch changes
CREATE OR REPLACE FUNCTION log_batch_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        COALESCE(NEW.added_by, CURRENT_USER_ID()),
        TG_OP,
        'stock_additions',
        NEW.addition_id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_batch_change ON stock_additions;
CREATE TRIGGER trigger_log_batch_change
AFTER INSERT OR UPDATE ON stock_additions
FOR EACH ROW EXECUTE FUNCTION log_batch_change();
