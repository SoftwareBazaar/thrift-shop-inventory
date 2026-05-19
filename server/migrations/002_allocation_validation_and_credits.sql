-- Migration: Allocation Validation & Credit Sales Enhancements
-- Prevents over-allocation and tracks payment status properly
-- Date: May 19, 2026
-- Status: Safe - Additive only

-- Enhance credit_sales table with payment tracking
ALTER TABLE credit_sales
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP;

-- Create payment history table for tracking multiple payments
CREATE TABLE IF NOT EXISTS payment_history (
    payment_id SERIAL PRIMARY KEY,
    credit_id INTEGER REFERENCES credit_sales(credit_id) ON DELETE CASCADE,
    payment_amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50),
    recorded_by INTEGER REFERENCES users(user_id),
    notes TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add function to validate allocation doesn't exceed available stock
CREATE OR REPLACE FUNCTION validate_allocation()
RETURNS TRIGGER AS $$
DECLARE
    available_stock INTEGER;
    total_allocated INTEGER;
BEGIN
    -- Get current available stock for the item
    SELECT current_stock INTO available_stock FROM items WHERE item_id = NEW.item_id;
    
    -- Get total already allocated (excluding this record if update)
    SELECT COALESCE(SUM(quantity_allocated), 0) INTO total_allocated
    FROM stock_distribution
    WHERE item_id = NEW.item_id AND distribution_id != COALESCE(NEW.distribution_id, -1);
    
    -- Check if new allocation would exceed available stock
    IF (total_allocated + NEW.quantity_allocated) > available_stock THEN
        RAISE EXCEPTION 'Allocation exceeds available stock. Available: %, Allocated: %, Requested: %',
            available_stock, total_allocated, NEW.quantity_allocated;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate allocations
DROP TRIGGER IF EXISTS trigger_validate_allocation ON stock_distribution;
CREATE TRIGGER trigger_validate_allocation
BEFORE INSERT OR UPDATE ON stock_distribution
FOR EACH ROW EXECUTE FUNCTION validate_allocation();

-- Add function to update payment status
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE credit_sales
    SET 
        payment_status = CASE
            WHEN NEW.amount_paid >= total_credit_amount THEN 'fully_paid'
            WHEN NEW.amount_paid > 0 THEN 'partially_paid'
            ELSE 'unpaid'
        END,
        payment_date = CURRENT_TIMESTAMP,
        payment_count = payment_count + 1
    WHERE credit_id = NEW.credit_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment history
DROP TRIGGER IF EXISTS trigger_log_payment ON payment_history;
CREATE TRIGGER trigger_log_payment
AFTER INSERT ON payment_history
FOR EACH ROW EXECUTE FUNCTION update_payment_status();

-- Create view for pending payments
CREATE OR REPLACE VIEW pending_payments AS
SELECT 
    cs.credit_id,
    cs.customer_name,
    cs.customer_contact,
    cs.total_credit_amount,
    cs.amount_paid,
    cs.balance_due,
    cs.payment_status,
    cs.due_date,
    DATE_PART('day', NOW() - cs.due_date)::INTEGER as days_overdue,
    CASE 
        WHEN cs.due_date < NOW() THEN 'OVERDUE'
        WHEN cs.due_date < NOW() + INTERVAL '7 days' THEN 'DUE SOON'
        ELSE 'OK'
    END as payment_urgency,
    s.sale_id,
    s.date_time as sale_date,
    i.item_name,
    ph.payment_count
FROM credit_sales cs
LEFT JOIN sales s ON cs.sale_id = s.sale_id
LEFT JOIN items i ON s.item_id = i.item_id
LEFT JOIN (
    SELECT credit_id, COUNT(*) as payment_count
    FROM payment_history
    GROUP BY credit_id
) ph ON cs.credit_id = ph.credit_id
WHERE cs.payment_status != 'fully_paid'
ORDER BY cs.due_date ASC;

-- Create function to check allocation variance
CREATE OR REPLACE FUNCTION check_allocation_variance()
RETURNS TABLE (
    item_id INTEGER,
    item_name VARCHAR,
    expected_available INTEGER,
    actual_allocated INTEGER,
    variance INTEGER,
    status VARCHAR
) AS $$
SELECT 
    i.item_id,
    i.item_name,
    i.current_stock,
    COALESCE(SUM(sd.quantity_allocated), 0) as total_allocated,
    i.current_stock - COALESCE(SUM(sd.quantity_allocated), 0) as variance,
    CASE 
        WHEN i.current_stock - COALESCE(SUM(sd.quantity_allocated), 0) < 0 THEN 'OVER_ALLOCATED'
        WHEN i.current_stock - COALESCE(SUM(sd.quantity_allocated), 0) = 0 THEN 'FULLY_ALLOCATED'
        ELSE 'NORMAL'
    END
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
GROUP BY i.item_id, i.item_name, i.current_stock
$$ LANGUAGE SQL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_history_credit_id ON payment_history(credit_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_date ON payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_credit_sales_customer ON credit_sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_credit_sales_due_date ON credit_sales(due_date);

-- Create view for reconciliation
CREATE OR REPLACE VIEW stock_reconciliation AS
SELECT 
    i.item_id,
    i.item_name,
    i.category,
    i.initial_stock,
    i.current_stock,
    COALESCE(SUM(DISTINCT sd.quantity_allocated), 0) as total_allocated,
    COALESCE(SUM(DISTINCT s.quantity_sold), 0) as total_sold,
    i.current_stock - (COALESCE(SUM(DISTINCT sd.quantity_allocated), 0) + COALESCE(SUM(DISTINCT s.quantity_sold), 0)) as variance
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
LEFT JOIN sales s ON i.item_id = s.item_id
GROUP BY i.item_id, i.item_name, i.category, i.initial_stock, i.current_stock;
