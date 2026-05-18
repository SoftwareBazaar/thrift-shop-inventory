-- Fix Stock Additions Data - SQL Script
-- This script recalculates total_added from actual stock_additions records
-- Run this in Supabase SQL Editor

-- Step 1: Check which items have incorrect total_added values
SELECT 
  i.item_id,
  i.item_name,
  i.total_added as database_value,
  COALESCE(SUM(sa.quantity_added), 0) as actual_value,
  COALESCE(SUM(sa.quantity_added), 0) - i.total_added as difference
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
GROUP BY i.item_id, i.item_name, i.total_added
HAVING COALESCE(SUM(sa.quantity_added), 0) != i.total_added
ORDER BY ABS(COALESCE(SUM(sa.quantity_added), 0) - i.total_added) DESC;

-- Step 2: Create backup of items table (optional but recommended)
-- CREATE TABLE items_backup_20260518 AS SELECT * FROM items;

-- Step 3: Fix the data - Update total_added to match actual additions
UPDATE items
SET total_added = (
  SELECT COALESCE(SUM(quantity_added), 0)
  FROM stock_additions
  WHERE stock_additions.item_id = items.item_id
)
WHERE item_id IN (
  SELECT i.item_id
  FROM items i
  LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
  GROUP BY i.item_id
  HAVING COALESCE(SUM(sa.quantity_added), 0) != i.total_added
);

-- Step 4: Verify the fix - should return 0 rows if successful
SELECT 
  i.item_id,
  i.item_name,
  i.total_added as database_value,
  COALESCE(SUM(sa.quantity_added), 0) as actual_value,
  COALESCE(SUM(sa.quantity_added), 0) - i.total_added as difference
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
GROUP BY i.item_id, i.item_name, i.total_added
HAVING COALESCE(SUM(sa.quantity_added), 0) != i.total_added;

-- Step 5: View all items with corrected values
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  i.total_added,
  COALESCE(SUM(sa.quantity_added), 0) as verified_total,
  i.initial_stock + i.total_added as total_received
FROM items i
LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
GROUP BY i.item_id, i.item_name, i.initial_stock, i.total_added
ORDER BY i.item_id;
