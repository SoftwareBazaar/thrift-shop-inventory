-- Migration 002: Allocation Validation & Constraints
-- Add validation and constraints to prevent data corruption

-- Add NOT NULL constraints where needed
ALTER TABLE stock_distribution 
ADD CONSTRAINT check_quantity_allocated CHECK (quantity_allocated > 0);

ALTER TABLE stock_withdrawals 
ADD CONSTRAINT check_quantity_withdrawn CHECK (quantity_withdrawn > 0);

ALTER TABLE payment_history 
ADD CONSTRAINT check_payment_amount CHECK (payment_amount > 0);

-- Add foreign key constraints
ALTER TABLE payment_history 
ADD CONSTRAINT fk_payment_history_sale 
FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE;

ALTER TABLE stock_withdrawals 
ADD CONSTRAINT fk_stock_withdrawals_item 
FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE;

-- Create function to validate allocation
CREATE OR REPLACE FUNCTION validate_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if allocation exceeds available stock
  IF NEW.quantity_allocated > (
    SELECT current_stock FROM items WHERE item_id = NEW.item_id
  ) THEN
    RAISE EXCEPTION 'Allocation exceeds available stock for item %', NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for allocation validation
DROP TRIGGER IF EXISTS validate_allocation_trigger ON stock_distribution;
CREATE TRIGGER validate_allocation_trigger 
BEFORE INSERT OR UPDATE ON stock_distribution
FOR EACH ROW EXECUTE FUNCTION validate_allocation();

-- Create function to validate withdrawal
CREATE OR REPLACE FUNCTION validate_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if reason is provided
  IF NEW.reason IS NULL OR NEW.reason = '' THEN
    RAISE EXCEPTION 'Withdrawal reason is required';
  END IF;
  
  -- Check if quantity is available
  IF NEW.quantity_withdrawn > (
    SELECT current_stock FROM items WHERE item_id = NEW.item_id
  ) THEN
    RAISE EXCEPTION 'Insufficient stock for withdrawal';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for withdrawal validation
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON stock_withdrawals;
CREATE TRIGGER validate_withdrawal_trigger 
BEFORE INSERT ON stock_withdrawals
FOR EACH ROW EXECUTE FUNCTION validate_withdrawal();

-- Create function to update item stock after withdrawal
CREATE OR REPLACE FUNCTION update_stock_after_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE items 
  SET current_stock = current_stock - NEW.quantity_withdrawn
  WHERE item_id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update stock after withdrawal
DROP TRIGGER IF EXISTS update_stock_after_withdrawal_trigger ON stock_withdrawals;
CREATE TRIGGER update_stock_after_withdrawal_trigger 
AFTER INSERT ON stock_withdrawals
FOR EACH ROW EXECUTE FUNCTION update_stock_after_withdrawal();

-- Create function to log activity
CREATE OR REPLACE FUNCTION log_activity()
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

-- Create triggers for audit logging
DROP TRIGGER IF EXISTS log_payment_history ON payment_history;
CREATE TRIGGER log_payment_history 
AFTER INSERT OR UPDATE OR DELETE ON payment_history
FOR EACH ROW EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS log_stock_withdrawals ON stock_withdrawals;
CREATE TRIGGER log_stock_withdrawals 
AFTER INSERT OR UPDATE OR DELETE ON stock_withdrawals
FOR EACH ROW EXECUTE FUNCTION log_activity();
