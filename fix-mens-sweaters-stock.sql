-- Fix Men's sweaters current_stock
-- Issue: current_stock is 68 but should be 32
-- Root cause: Sales (36 units) were not deducted from current_stock

-- Current state:
-- initial_stock: 19
-- total_added: 94
-- total_allocated: 45
-- total_sold: 36
-- current_stock: 68 (WRONG - should be 32)

-- Correct calculation:
-- Total inventory = 19 + 94 = 113
-- Allocated = 45 + 36 = 81
-- Available = 113 - 81 = 32

-- Fix: Update current_stock to correct value
UPDATE items 
SET current_stock = 32
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
-- current_stock: 32 (was 68, now corrected)
-- This means client can only distribute 32 units, not 68
