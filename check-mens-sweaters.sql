-- Check Men's sweaters inventory data
-- Issue: System says trying to allocate 71 when client entered 26 + 42 = 68

-- Step 1: Find Men's sweaters item
SELECT item_id, item_name, initial_stock, current_stock 
FROM items 
WHERE item_name LIKE '%sweater%' OR item_name LIKE '%Sweater%';

-- Step 2: Check existing distributions for Men's sweaters
SELECT distribution_id, item_id, stall_id, quantity_allocated, date_distributed
FROM stock_distribution
WHERE item_id = (SELECT item_id FROM items WHERE item_name LIKE '%sweater%' LIMIT 1)
ORDER BY date_distributed DESC;

-- Step 3: Check stock additions for Men's sweaters
SELECT addition_id, item_id, quantity_added, date_added
FROM stock_additions
WHERE item_id = (SELECT item_id FROM items WHERE item_name LIKE '%sweater%' LIMIT 1)
ORDER BY date_added;

-- Step 4: Check sales for Men's sweaters (fixed column name)
SELECT sale_id, item_id, quantity_sold, date_time
FROM sales
WHERE item_id = (SELECT item_id FROM items WHERE item_name LIKE '%sweater%' LIMIT 1)
ORDER BY date_time DESC
LIMIT 10;

-- Step 5: Full inventory summary
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  i.current_stock,
  COALESCE((SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = i.item_id), 0) as total_added,
  COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = i.item_id), 0) as total_allocated,
  COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = i.item_id), 0) as total_sold,
  COALESCE((SELECT SUM(quantity_withdrawn) FROM stock_withdrawals WHERE item_id = i.item_id), 0) as total_withdrawn
FROM items i
WHERE i.item_name LIKE '%sweater%';
