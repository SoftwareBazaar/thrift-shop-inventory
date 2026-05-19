-- Debug query to check actual baggy jeans quantities
-- Run this to see the exact breakdown

-- 1. Check the item details
SELECT 
  item_id,
  item_name,
  initial_stock,
  total_added,
  total_allocated,
  current_stock,
  (initial_stock + total_added) as total_received
FROM items
WHERE item_name ILIKE '%baggy%jean%';

-- 2. Check stock additions (quantity details)
SELECT 
  addition_id,
  item_id,
  quantity_added,
  date_added,
  added_by
FROM stock_additions sa
JOIN items i ON sa.item_id = i.item_id
WHERE i.item_name ILIKE '%baggy%jean%'
ORDER BY date_added;

-- 3. Check distributions (quantity details)
SELECT 
  distribution_id,
  item_id,
  stall_id,
  quantity_allocated,
  date_distributed
FROM stock_distribution sd
JOIN items i ON sd.item_id = i.item_id
WHERE i.item_name ILIKE '%baggy%jean%'
ORDER BY date_distributed;

-- 4. Check sales (central vs stall)
SELECT 
  sale_id,
  item_id,
  stall_id,
  quantity_sold,
  CASE 
    WHEN stall_id IS NULL THEN 'CENTRAL'
    ELSE 'STALL ' || stall_id::text
  END as sale_location,
  date_time
FROM sales s
JOIN items i ON s.item_id = i.item_id
WHERE i.item_name ILIKE '%baggy%jean%'
ORDER BY date_time;

-- 5. Check withdrawals (THIS IS KEY!)
SELECT 
  withdrawal_id,
  item_id,
  quantity_withdrawn,
  reason,
  date_withdrawn,
  withdrawn_by
FROM stock_withdrawals sw
JOIN items i ON sw.item_id = i.item_id
WHERE i.item_name ILIKE '%baggy%jean%'
ORDER BY date_withdrawn;

-- 6. Calculate the correct stock manually
SELECT 
  i.item_name,
  i.initial_stock,
  COALESCE(SUM(sa.quantity_added), 0) as total_additions,
  (i.initial_stock + COALESCE(SUM(sa.quantity_added), 0)) as total_received,
  COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = i.item_id), 0) as total_distributed,
  COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = i.item_id AND stall_id IS NULL), 0) as central_sales,
  COALESCE((SELECT SUM(quantity_withdrawn) FROM stock_withdrawals WHERE item_id = i.item_id), 0) as total_withdrawn,
  -- THE FORMULA:
  (i.initial_stock + COALESCE(SUM(sa.quantity_added), 0)) 
  - COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = i.item_id), 0)
  - COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = i.item_id AND stall_id IS NULL), 0)
  - COALESCE((SELECT SUM(quantity_withdrawn) FROM stock_withdrawals WHERE item_id = i.item_id), 0) as calculated_stock,
  i.current_stock as db_current_stock
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
WHERE i.item_name ILIKE '%baggy%jean%'
GROUP BY i.item_id, i.item_name, i.initial_stock, i.current_stock;
