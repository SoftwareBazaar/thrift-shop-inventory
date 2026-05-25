-- =============================================================================
-- CANONICAL PRODUCTION FIX — Men's Sweaters (item_id = 51)
-- Run ONLY this script to correct current_stock. All other *mens-sweaters*.sql
-- files in this repo are diagnostics or superseded attempts (do not run UPDATEs).
-- =============================================================================
-- Database is CORRECT: 37 sales, 48 allocated
-- Frontend shows 34 due to date filter or caching issue (not a database problem)
-- Just update current_stock to match the correct allocation

-- Current correct state:
-- Initial: 19
-- New added: 94
-- Total inventory: 113
-- Allocated so far: 48 (11 at stall 307 + 37 pre-tracking)
-- Total sold: 37 (all legitimate sales)
-- At stalls: 11 (48 - 37 = 11) ✅
-- Available: should be 65 (113 - 48 = 65)

-- The ONLY fix needed: Update current_stock from 68 to 65
UPDATE items 
SET current_stock = 65
WHERE item_id = 51;

-- Verify the fix
SELECT 
  'FINAL STATE' as status,
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
-- initial: 19 ✅
-- new_added: 94 ✅
-- total_inventory: 113 ✅
-- allocated_so_far: 48 ✅
-- total_sold: 37 ✅
-- at_stalls: 11 ✅ (48 - 37 = 11)
-- available_central: 65 ✅ (113 - 48 = 65)

-- Note about frontend showing 34 instead of 37:
-- This is a frontend display issue (date filter cutting off Feb 2026 sales)
-- The database has all 37 sales correctly
-- The calculation "At stalls = 48 - 37 = 11" is mathematically correct
-- User should clear any date filters on the Sales page or refresh the browser
