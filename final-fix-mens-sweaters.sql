-- CORRECTED FIX FOR MEN'S SWEATERS INVENTORY
-- Initial: 19
-- Added: 94
-- Total Received: 113
-- Sold: 33
-- Available: 113 - 33 = 80 units

-- Fix: Set correct current_stock
-- 113 (total) - 33 (sold) = 80
UPDATE items
SET current_stock = 80
WHERE item_id = 51;

-- Verify the fix
SELECT 'CORRECTED INVENTORY FOR MEN''S SWEATERS:' as section;
SELECT 
  item_id,
  item_name,
  initial_stock,
  current_stock,
  'Available for distribution: 80 units' as note
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
SELECT 'Sold (removed from inventory)', 33
UNION ALL
SELECT 'AVAILABLE FOR DISTRIBUTION', 80;
