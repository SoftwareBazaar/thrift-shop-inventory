-- REAL INVENTORY CALCULATION FOR MEN'S SWEATERS
-- Simple math: Total - Sold - Allocated = Available

SELECT 'MEN''S SWEATERS ACTUAL INVENTORY:' as section;
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  (SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = 51) as total_stock_added,
  (i.initial_stock + COALESCE((SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = 51), 0)) as total_received,
  (SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51) as total_sold,
  i.total_allocated as total_allocated_db,
  (SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = 51) as total_allocated_actual,
  
  -- Real calculation
  (i.initial_stock + COALESCE((SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = 51), 0)
   - COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51), 0)
   - COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = 51), 0)) as REAL_AVAILABLE,
  
  i.current_stock as current_stock_in_db
FROM items i
WHERE i.item_id = 51;

-- Show the problem
SELECT 'THE PROBLEM:' as section;
SELECT 
  'Total Received' as field,
  113 as value
UNION ALL
SELECT 'Less: Sold', -33
UNION ALL
SELECT 'Less: Allocated', -23
UNION ALL
SELECT '= REAL AVAILABLE', 57
UNION ALL
SELECT '', NULL
UNION ALL
SELECT 'But system shows:', NULL
UNION ALL
SELECT 'current_stock', 90;
