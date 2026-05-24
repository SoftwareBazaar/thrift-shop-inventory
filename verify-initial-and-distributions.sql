-- VERIFY INITIAL STOCK AND FIND MISSING 10 UNITS IN DISTRIBUTION HISTORY

-- Step 1: Verify the initial_stock value in items table
SELECT 'VERIFY INITIAL STOCK:' as section;
SELECT 
  item_id,
  item_name,
  initial_stock
FROM items
WHERE item_id = 51;

-- Step 2: Show ALL distribution/allocation records
SELECT 'ALL DISTRIBUTIONS FOR MEN''S SWEATERS:' as section;
SELECT 
  distribution_id,
  stall_id,
  quantity_allocated,
  date_distributed
FROM stock_distribution
WHERE item_id = 51
ORDER BY date_distributed ASC;

-- Step 3: Sum all allocations
SELECT 'TOTAL ALLOCATIONS:' as section;
SELECT 
  COUNT(*) as total_records,
  SUM(quantity_allocated) as total_quantity
FROM stock_distribution
WHERE item_id = 51;

-- Step 4: Find the discrepancy
SELECT 'DISCREPANCY ANALYSIS:' as section;
SELECT 
  'Total Sold' as field,
  33 as value
UNION ALL
SELECT 'Shown as Allocated in UI', 23
UNION ALL
SELECT 'Difference (Missing from history)', 10
UNION ALL
SELECT '', NULL
UNION ALL
SELECT 'If actual allocated is', 33
UNION ALL
SELECT 'Then truly available is:', 47;

-- Step 5: Show complete inventory calculation with actual numbers
SELECT 'COMPLETE INVENTORY BREAKDOWN:' as section;
SELECT 
  'Total Received (19 + 94)' as calculation,
  113 as units
UNION ALL
SELECT 'Less: Sold', -33
UNION ALL
SELECT 'Less: Allocated (if 33)', -33
UNION ALL
SELECT '= ACTUAL AVAILABLE', 47;
