-- Fix Baggy Jeans inventory - correct initial_stock and total_added
-- Date: 26/02/2026, 18:20
-- Issue: initial_stock is hardcoded as 12, but should be 3 (from addition history)
-- Solution: Set initial_stock to 3, and adjust total_added to 97

-- Step 1: Check current state
SELECT item_id, item_name, initial_stock, current_stock FROM items WHERE item_name = 'Baggy Jeans';

-- Step 2: Check stock additions history
SELECT addition_id, item_id, quantity_added, date_added FROM stock_additions 
WHERE item_id = (SELECT item_id FROM items WHERE item_name = 'Baggy Jeans' LIMIT 1)
ORDER BY date_added;

-- Step 3: Update initial_stock from 12 to 3
UPDATE items 
SET initial_stock = 3
WHERE item_name = 'Baggy Jeans';

-- Step 4: Verify the fix
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  (SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = items.item_id) as total_added
FROM items 
WHERE item_name = 'Baggy Jeans';

-- Expected result after fix:
-- initial_stock: 3 (corrected from 12)
-- current_stock: 100 (stays the same)
-- total_added: 97 (sum of all additions except the initial 3)
-- This means: 3 (initial) + 97 (added) = 100 total inventory
