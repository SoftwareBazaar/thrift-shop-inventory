-- STOCK ADDITIONS DIAGNOSTIC
-- Check what stock has ever been added to Men's Sweaters
-- Initial: 19, Stock Additions: 94, Total: 113

SELECT 'STOCK ADDITIONS HISTORY FOR MEN''S SWEATERS (item_id = 51):' as section;
SELECT 
  addition_id,
  item_id,
  quantity_added,
  date_added
FROM stock_additions
WHERE item_id = 51
ORDER BY date_added ASC;

-- Verify totals
SELECT 'SUMMARY:' as section;
SELECT 
  COUNT(*) as total_additions,
  SUM(quantity_added) as total_quantity_added,
  MIN(date_added) as first_addition,
  MAX(date_added) as last_addition
FROM stock_additions
WHERE item_id = 51;

-- Double-check initial stock
SELECT 'INITIAL STOCK IN ITEMS TABLE:' as section;
SELECT 
  item_id,
  item_name,
  initial_stock
FROM items
WHERE item_id = 51;

-- Show items table current state
SELECT 'CURRENT ITEMS TABLE STATE:' as section;
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  total_allocated
FROM items
WHERE item_id = 51;
