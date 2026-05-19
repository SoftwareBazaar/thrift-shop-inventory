-- Add constraints to prevent negative stock values
-- This prevents data corruption from invalid operations

-- Add check constraint to items table
ALTER TABLE items 
ADD CONSTRAINT check_current_stock_non_negative 
CHECK (current_stock >= 0);

-- Add check constraint to stock_additions table
ALTER TABLE stock_additions 
ADD CONSTRAINT check_quantity_added_positive 
CHECK (quantity_added > 0);

-- Add check constraint to stock_distribution table
ALTER TABLE stock_distribution 
ADD CONSTRAINT check_quantity_allocated_positive 
CHECK (quantity_allocated > 0);

-- Add check constraint to sales table
ALTER TABLE sales 
ADD CONSTRAINT check_quantity_sold_positive 
CHECK (quantity_sold > 0);

-- Add check constraint to stock_withdrawals table
ALTER TABLE stock_withdrawals 
ADD CONSTRAINT check_quantity_withdrawn_positive 
CHECK (quantity_withdrawn > 0);

-- Verify no existing negative stock
SELECT item_id, item_name, current_stock 
FROM items 
WHERE current_stock < 0;

-- If the above query returns any rows, those items have invalid data
-- You may need to manually fix them before the constraints can be applied
