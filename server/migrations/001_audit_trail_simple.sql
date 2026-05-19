-- Migration 001: Audit Trail System
-- Simple version that works with your schema

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id BIGINT,
  old_values JSONB,
  new_values JSONB,
  user_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create table for payment history
CREATE TABLE IF NOT EXISTS payment_history (
  id BIGSERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_method TEXT,
  payment_date TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Create table for stock withdrawals
CREATE TABLE IF NOT EXISTS stock_withdrawals (
  id BIGSERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  quantity_withdrawn INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  batch_number TEXT,
  withdrawn_date TIMESTAMP DEFAULT NOW(),
  withdrawn_by INTEGER
);

-- Create reconciliation view
CREATE OR REPLACE VIEW stock_reconciliation AS
SELECT 
  i.item_id,
  i.item_name,
  i.category,
  i.initial_stock,
  i.total_added,
  (i.initial_stock + i.total_added) as total_received,
  i.current_stock,
  COALESCE(SUM(sd.quantity_allocated), 0) as total_allocated,
  (i.current_stock - COALESCE(SUM(sd.quantity_allocated), 0)) as available_stock
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
GROUP BY i.item_id, i.item_name, i.category, i.initial_stock, i.total_added, i.current_stock;

-- Create allocation variance view
CREATE OR REPLACE VIEW allocation_variance AS
SELECT 
  i.item_id,
  i.item_name,
  i.current_stock,
  COALESCE(SUM(sd.quantity_allocated), 0) as total_allocated,
  CASE 
    WHEN COALESCE(SUM(sd.quantity_allocated), 0) > i.current_stock THEN 'OVER_ALLOCATED'
    WHEN COALESCE(SUM(sd.quantity_allocated), 0) = i.current_stock THEN 'FULLY_ALLOCATED'
    ELSE 'NORMAL'
  END as allocation_status
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
GROUP BY i.item_id, i.item_name, i.current_stock;

-- Create pending payments view
CREATE OR REPLACE VIEW pending_payments AS
SELECT 
  s.sale_id,
  s.item_id,
  s.customer_name,
  s.total_amount,
  COALESCE(SUM(ph.payment_amount), 0) as total_paid,
  (s.total_amount - COALESCE(SUM(ph.payment_amount), 0)) as amount_due,
  s.date_time as sale_date,
  CASE 
    WHEN (s.total_amount - COALESCE(SUM(ph.payment_amount), 0)) <= 0 THEN 'PAID'
    WHEN (s.total_amount - COALESCE(SUM(ph.payment_amount), 0)) > 0 THEN 'PENDING'
  END as payment_status
FROM sales s
LEFT JOIN payment_history ph ON s.sale_id = ph.sale_id
WHERE s.sale_type = 'credit'
GROUP BY s.sale_id, s.item_id, s.customer_name, s.total_amount, s.date_time;

-- Create recent activity view
CREATE OR REPLACE VIEW recent_activity AS
SELECT * FROM activity_log
ORDER BY created_at DESC
LIMIT 500;
