-- =============================================================================
-- SUPERSEDED — diagnostic only (do not run UPDATE/INSERT from this file)
-- Canonical production fix: final-fix-mens-sweaters.sql (current_stock = 65)
-- =============================================================================
-- This file previously set current_stock = 80 using an outdated assumption
-- (allocated=33, sold=33). Current data: allocated=48, sold=37, available=65.

-- Verify current state (read-only)
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  total_added,
  total_allocated,
  (initial_stock + COALESCE(total_added, 0)) as total_inventory,
  (SELECT COALESCE(SUM(quantity_allocated), 0) FROM stock_distribution WHERE item_id = 51) as dist_sum,
  (SELECT COALESCE(SUM(quantity_sold), 0) FROM sales WHERE item_id = 51) as total_sold,
  (initial_stock + COALESCE(total_added, 0)) - total_allocated as expected_available
FROM items 
WHERE item_id = 51;

-- OBSOLETE (wrong — do not run):
-- UPDATE items SET current_stock = 80 WHERE item_id = 51;
-- INSERT INTO stock_distribution (item_id, stall_id, quantity_allocated, date_distributed, distributed_by)
-- VALUES (51, 1, 10, '2026-02-01 00:00:00', 1);
