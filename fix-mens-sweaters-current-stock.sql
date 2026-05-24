-- Fix Men's sweaters current_stock
-- Database calculation shows 80 available, but current_stock column still shows 90

-- Update current_stock to the correct value
UPDATE items 
SET current_stock = 80
WHERE item_id = 51;

-- Verify the fix
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  (SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = 51) as total_added,
  (SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = 51) as total_allocated,
  (SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51) as total_sold
FROM items 
WHERE item_id = 51;

-- Expected result:
-- current_stock: 80
-- Total: 19 + 94 = 113
-- Allocated: 33 (sold)
-- Available: 113 - 33 = 80
