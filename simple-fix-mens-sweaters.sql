-- =============================================================================
-- SUPERSEDED — diagnostic only (do not run UPDATE from this file)
-- Canonical production fix: final-fix-mens-sweaters.sql (current_stock = 65)
-- =============================================================================
-- Men's Sweaters: 37 sold, 48 allocated, 11 at stalls, 65 available central

-- Current state verification:
SELECT 
  'CURRENT STATE' as status,
  i.item_id,
  i.item_name,
  i.initial_stock as initial,
  i.total_added as new_added,
  (i.initial_stock + i.total_added) as total_inventory,
  i.total_allocated as allocated_so_far,
  (SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51) as total_sold,
  (i.total_allocated - (SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51)) as at_stalls,
  i.current_stock as available_central
FROM items i
WHERE i.item_id = 51;

-- Show all sales for Men's Sweaters
SELECT 
  sale_id,
  item_id,
  stall_id,
  quantity_sold,
  date_time,
  recorded_by,
  sale_type
FROM sales
WHERE item_id = 51
ORDER BY date_time DESC;

-- Count sales
SELECT 
  COUNT(*) as number_of_sales,
  SUM(quantity_sold) as total_units_sold
FROM sales
WHERE item_id = 51;

-- Apply fix via final-fix-mens-sweaters.sql (not here).

-- Expected state after running final-fix-mens-sweaters.sql:
SELECT 
  'AFTER FIX' as status,
  i.item_id,
  i.item_name,
  i.initial_stock as initial,
  i.total_added as new_added,
  (i.initial_stock + i.total_added) as total_inventory,
  i.total_allocated as allocated_so_far,
  (SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51) as total_sold,
  (i.total_allocated - (SELECT SUM(quantity_sold) FROM sales WHERE item_id = 51)) as at_stalls,
  i.current_stock as available_central
FROM items i
WHERE i.item_id = 51;

-- Expected result:
-- initial: 19
-- new_added: 94
-- total_inventory: 113
-- allocated_so_far: 48
-- total_sold: 37
-- at_stalls: 11 (48 - 37 = 11) ✅
-- available_central: 65 (113 - 48 = 65) ✅

-- Frontend should show:
-- Available to distribute: 65 ✅
-- At stalls: 11 ✅
-- Sold: 37 ✅
-- Allocated so far: 48 ✅
