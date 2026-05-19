-- Migration 003: Batch & Expiration Tracking
-- Add batch and expiration date tracking

-- Add columns to items table for batch and expiration tracking
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiration_date DATE,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();

-- Add columns to stock_distribution for batch tracking
ALTER TABLE stock_distribution 
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Add columns to stock_additions for batch tracking
ALTER TABLE stock_additions 
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Create table for batch inventory tracking
CREATE TABLE IF NOT EXISTS batch_inventory (
  id BIGSERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_sold INTEGER DEFAULT 0,
  quantity_withdrawn INTEGER DEFAULT 0,
  expiration_date DATE,
  received_date TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

-- Create view for expired stock
CREATE OR REPLACE VIEW expired_stock AS
SELECT 
  i.item_id,
  i.item_name,
  i.category,
  i.batch_number,
  i.expiration_date,
  i.current_stock,
  CURRENT_DATE as today,
  (i.expiration_date - CURRENT_DATE) as days_until_expiration
FROM items i
WHERE i.expiration_date IS NOT NULL 
  AND i.expiration_date <= CURRENT_DATE
  AND i.current_stock > 0
ORDER BY i.expiration_date ASC;

-- Create view for expiring soon (within 30 days)
CREATE OR REPLACE VIEW expiring_soon AS
SELECT 
  i.item_id,
  i.item_name,
  i.category,
  i.batch_number,
  i.expiration_date,
  i.current_stock,
  CURRENT_DATE as today,
  (i.expiration_date - CURRENT_DATE) as days_until_expiration
FROM items i
WHERE i.expiration_date IS NOT NULL 
  AND i.expiration_date > CURRENT_DATE
  AND i.expiration_date <= (CURRENT_DATE + INTERVAL '30 days')
  AND i.current_stock > 0
ORDER BY i.expiration_date ASC;

-- Create view for batch inventory summary
CREATE OR REPLACE VIEW batch_inventory_summary AS
SELECT 
  bi.item_id,
  i.item_name,
  bi.batch_number,
  bi.quantity_received,
  bi.quantity_sold,
  bi.quantity_withdrawn,
  (bi.quantity_received - bi.quantity_sold - bi.quantity_withdrawn) as quantity_available,
  bi.expiration_date,
  bi.received_date,
  CASE 
    WHEN bi.expiration_date IS NULL THEN 'NO_EXPIRATION'
    WHEN bi.expiration_date < CURRENT_DATE THEN 'EXPIRED'
    WHEN bi.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'EXPIRING_SOON'
    ELSE 'OK'
  END as expiration_status
FROM batch_inventory bi
JOIN items i ON bi.item_id = i.item_id
ORDER BY bi.expiration_date ASC;

-- Create function to update batch inventory on sale
CREATE OR REPLACE FUNCTION update_batch_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE batch_inventory 
  SET quantity_sold = quantity_sold + NEW.quantity_sold
  WHERE item_id = NEW.item_id
  ORDER BY received_date ASC
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update batch on sale
DROP TRIGGER IF EXISTS update_batch_on_sale_trigger ON sales;
CREATE TRIGGER update_batch_on_sale_trigger 
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION update_batch_on_sale();

-- Create function to update batch inventory on withdrawal
CREATE OR REPLACE FUNCTION update_batch_on_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE batch_inventory 
  SET quantity_withdrawn = quantity_withdrawn + NEW.quantity_withdrawn
  WHERE item_id = NEW.item_id
    AND (NEW.batch_number IS NULL OR batch_number = NEW.batch_number)
  ORDER BY received_date ASC
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update batch on withdrawal
DROP TRIGGER IF EXISTS update_batch_on_withdrawal_trigger ON stock_withdrawals;
CREATE TRIGGER update_batch_on_withdrawal_trigger 
AFTER INSERT ON stock_withdrawals
FOR EACH ROW EXECUTE FUNCTION update_batch_on_withdrawal();

-- Create function to log batch changes
CREATE OR REPLACE FUNCTION log_batch_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (table_name, operation, record_id, old_values, new_values, created_at)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    NOW()
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for batch inventory logging
DROP TRIGGER IF EXISTS log_batch_inventory ON batch_inventory;
CREATE TRIGGER log_batch_inventory 
AFTER INSERT OR UPDATE OR DELETE ON batch_inventory
FOR EACH ROW EXECUTE FUNCTION log_batch_activity();
