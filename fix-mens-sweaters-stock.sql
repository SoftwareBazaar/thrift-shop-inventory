-- =============================================================================
-- SUPERSEDED — diagnostic only (do not run UPDATE from this file)
-- Canonical production fix: final-fix-mens-sweaters.sql (current_stock = 65)
-- =============================================================================
-- This file previously set current_stock = 32 (double-counted sold as allocation).

SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  total_added,
  total_allocated,
  (initial_stock + COALESCE(total_added, 0)) as total_inventory,
  (SELECT COALESCE(SUM(quantity_sold), 0) FROM sales WHERE item_id = 51) as total_sold,
  (SELECT COALESCE(SUM(quantity_allocated), 0) FROM stock_distribution WHERE item_id = 51) as dist_sum
FROM items 
WHERE item_id = 51;

-- OBSOLETE (wrong — do not run):
-- UPDATE items SET current_stock = 32 WHERE item_id = 51;
