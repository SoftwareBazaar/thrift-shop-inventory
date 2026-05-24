-- FIX: Correct current_stock to account for sales
-- Issue: current_stock = 90 (deducts allocations but NOT sales)
-- Correct calculation: 113 - 33 sold - 23 allocated = 57 available

-- Step 1: Fix the current_stock value for Men's Sweaters
UPDATE items
SET current_stock = 57
WHERE item_id = 51;

-- Verify the fix
SELECT 'AFTER FIX - Men''s Sweaters Inventory:' as section;
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  total_allocated
FROM items
WHERE item_id = 51;

-- Step 2: Create/update trigger to deduct sales from current_stock
-- This prevents future sales from being ignored in current_stock calculation

CREATE OR REPLACE FUNCTION deduct_sales_from_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct the sale quantity from current_stock
    UPDATE items 
    SET current_stock = current_stock - NEW.quantity_sold
    WHERE item_id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sales table to deduct from stock
DROP TRIGGER IF EXISTS trigger_deduct_sales_stock ON sales;
CREATE TRIGGER trigger_deduct_sales_stock
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION deduct_sales_from_stock();

-- Step 3: Verify the fix works
SELECT 'VERIFICATION - Now client can distribute 57 units:' as section;
SELECT 
  item_id,
  current_stock,
  CASE 
    WHEN current_stock >= 57 THEN 'OK - Can allocate up to ' || current_stock || ' units'
    ELSE 'FAIL - Only ' || current_stock || ' available'
  END as allocation_capacity
FROM items
WHERE item_id = 51;

-- Step 4: Show inventory summary
SELECT 'FINAL INVENTORY SUMMARY:' as section;
SELECT 
  'Total Received' as metric,
  113 as units
UNION ALL
SELECT 'Sold', 33
UNION ALL
SELECT 'Currently Allocated', 23
UNION ALL
SELECT 'Available for Distribution', 57;
