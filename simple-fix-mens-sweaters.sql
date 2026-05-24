-- SIMPLE FIX FOR MEN'S SWEATERS INVENTORY
-- Initial: 19
-- Added: 94
-- Total Received: 113
-- Sold: 33
-- Allocated: 33 (23 tracked + 10 before tracking table existed)
-- Available: 47

-- Fix 1: Set total_allocated to 33 (actual total including pre-tracking allocations)
UPDATE items
SET total_allocated = 33
WHERE item_id = 51;

-- Fix 2: Calculate and set correct current_stock
-- 113 (total) - 33 (sold) - 33 (allocated) = 47
UPDATE items
SET current_stock = 47
WHERE item_id = 51;

-- Verify the fix
SELECT 'CORRECTED INVENTORY FOR MEN''S SWEATERS:' as section;
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  total_allocated,
  'Available for distribution: 47 units' as note
FROM items
WHERE item_id = 51;

-- Summary
SELECT 'INVENTORY SUMMARY:' as section;
SELECT 
  'Initial Stock' as field,
  19 as units
UNION ALL
SELECT 'Stock Additions', 94
UNION ALL
SELECT 'Total Received', 113
UNION ALL
SELECT 'Sold', 33
UNION ALL
SELECT 'Allocated (including pre-tracking)', 33
UNION ALL
SELECT 'Available for Distribution', 47;
