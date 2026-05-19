-- SQL Script to Fix Inventory Stock Calculations
-- Run this in Supabase SQL Editor
-- This recalculates current_stock, total_added, and total_allocated for all items

-- Step 1: Show current state (for verification)
SELECT 
  item_id,
  item_name,
  initial_stock,
  total_added as total_added_old,
  current_stock as current_stock_old,
  total_allocated as total_allocated_old
FROM items
ORDER BY item_name;

-- Step 2: Update all items with correct calculations
UPDATE items
SET 
  total_added = COALESCE((
    SELECT SUM(quantity_added)
    FROM stock_additions
    WHERE stock_additions.item_id = items.item_id
  ), 0),
  
  total_allocated = COALESCE((
    SELECT SUM(quantity_allocated)
    FROM stock_distribution
    WHERE stock_distribution.item_id = items.item_id
  ), 0),
  
  current_stock = GREATEST(0,
    -- Formula: initial + additions - distributed - central_sales - withdrawals
    COALESCE(initial_stock, 0) +
    COALESCE((
      SELECT SUM(quantity_added)
      FROM stock_additions
      WHERE stock_additions.item_id = items.item_id
    ), 0) -
    COALESCE((
      SELECT SUM(quantity_allocated)
      FROM stock_distribution
      WHERE stock_distribution.item_id = items.item_id
    ), 0) -
    COALESCE((
      SELECT SUM(quantity_sold)
      FROM sales
      WHERE sales.item_id = items.item_id
        AND sales.stall_id IS NULL  -- Central sales only
    ), 0) -
    COALESCE((
      SELECT SUM(quantity_withdrawn)
      FROM stock_withdrawals
      WHERE stock_withdrawals.item_id = items.item_id
    ), 0)
  );

-- Step 3: Show updated state (for verification)
SELECT 
  item_id,
  item_name,
  initial_stock,
  total_added as total_added_new,
  current_stock as current_stock_new,
  total_allocated as total_allocated_new,
  -- Show the breakdown
  initial_stock + total_added as total_received
FROM items
ORDER BY item_name;

-- Step 4: Verify baggy jeans specifically
SELECT 
  item_name,
  initial_stock,
  total_added,
  total_allocated,
  current_stock,
  initial_stock + total_added as total_received,
  (SELECT COUNT(*) FROM stock_additions WHERE item_id = items.item_id) as additions_count,
  (SELECT COUNT(*) FROM stock_distribution WHERE item_id = items.item_id) as distributions_count,
  (SELECT COUNT(*) FROM sales WHERE item_id = items.item_id AND stall_id IS NULL) as central_sales_count,
  (SELECT COUNT(*) FROM stock_withdrawals WHERE item_id = items.item_id) as withdrawals_count
FROM items
WHERE item_name ILIKE '%baggy%jean%'
ORDER BY item_name;
