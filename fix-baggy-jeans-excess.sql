-- Fix Baggy jeans - remove the duplicate 3 from stock_additions
-- The 3 added on 26/02/2026, 18:20 is actually the initial stock, not an addition
-- We need to delete this entry so total_added = 97 instead of 100

-- Step 1: Find the addition to delete
SELECT addition_id, item_id, quantity_added, date_added FROM stock_additions 
WHERE item_id = 80 
ORDER BY date_added;

-- Step 2: Delete the 3-unit addition from 26/02/2026, 18:20
DELETE FROM stock_additions 
WHERE item_id = 80 
AND quantity_added = 3 
AND DATE(date_added) = '2026-02-26';

-- Step 3: Verify the fix
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  (SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = items.item_id) as total_added
FROM items 
WHERE item_id = 80;

-- Expected result:
-- initial_stock: 3
-- current_stock: 100
-- total_added: 97 (was 100, now 100 - 3 = 97)
-- Total Inventory: 3 + 97 = 100
