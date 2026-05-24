-- Diagnostic: Where did the 14 missing units go?
-- UI shows: Available to distribute: 68
-- Database shows: current_stock: 54
-- Difference: 14 units unaccounted for

SELECT 'INVENTORY BREAKDOWN FOR MEN''S SWEATERS:' as section;
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  COALESCE((SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = 51), 0) as total_added,
  COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = 51), 0) as total_allocated,
  COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51), 0) as total_sold,
  COALESCE((SELECT SUM(quantity_withdrawn) FROM stock_withdrawals WHERE item_id = 51), 0) as total_withdrawn,
  i.current_stock,
  (i.initial_stock + COALESCE((SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = 51), 0) 
   - COALESCE((SELECT SUM(quantity_allocated) FROM stock_distribution WHERE item_id = 51), 0)
   - COALESCE((SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51), 0)
   - COALESCE((SELECT SUM(quantity_withdrawn) FROM stock_withdrawals WHERE item_id = 51), 0)) as calculated_available
FROM items i
WHERE i.item_id = 51;

-- Show all sales for Men's sweaters
SELECT 'RECENT SALES:' as section;
SELECT sale_id, quantity_sold, date_time, payment_type, notes
FROM sales
WHERE item_id = 51
ORDER BY date_time DESC
LIMIT 10;

-- Show all withdrawals
SELECT 'STOCK WITHDRAWALS:' as section;
SELECT withdrawal_id, quantity_withdrawn, reason, date_withdrawn, withdrawn_by
FROM stock_withdrawals
WHERE item_id = 51
ORDER BY date_withdrawn DESC;

-- Show all current allocations (after cleanup)
SELECT 'CURRENT ALLOCATIONS:' as section;
SELECT distribution_id, stall_id, quantity_allocated, date_distributed, notes
FROM stock_distribution
WHERE item_id = 51
ORDER BY date_distributed DESC;
