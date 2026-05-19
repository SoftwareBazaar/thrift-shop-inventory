-- Verify Where the 26 Items Are Located
-- This query shows exactly where all items are in the system

-- For Pants item specifically
SELECT 
  i.item_id,
  i.item_name,
  i.initial_stock,
  i.current_stock as "Stock at Hub (Central)",
  COALESCE(SUM(sd.quantity_allocated), 0) as "Total Allocated to Stalls",
  COALESCE(SUM(CASE WHEN s.stall_id IS NOT NULL THEN sd.quantity_allocated ELSE 0 END), 0) as "At Stalls (Unsold)",
  COALESCE(SUM(s.quantity_sold), 0) as "Total Sold",
  COALESCE(SUM(sw.quantity_withdrawn), 0) as "Total Withdrawn",
  i.current_stock + COALESCE(SUM(sd.quantity_allocated), 0) + COALESCE(SUM(s.quantity_sold), 0) as "Total in System"
FROM items i
LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
LEFT JOIN sales s ON i.item_id = s.item_id
LEFT JOIN stock_withdrawals sw ON i.item_id = sw.item_id
WHERE i.item_name = 'Pants'
GROUP BY i.item_id, i.item_name, i.initial_stock, i.current_stock;

-- Detailed breakdown by location
SELECT 
  'Central Hub' as location,
  i.current_stock as quantity
FROM items i
WHERE i.item_name = 'Pants'

UNION ALL

SELECT 
  'At Stalls (Unsold)' as location,
  COALESCE(SUM(sd.quantity_allocated - COALESCE(s.quantity_sold, 0)), 0) as quantity
FROM stock_distribution sd
LEFT JOIN sales s ON sd.item_id = s.item_id
WHERE sd.item_id = (SELECT item_id FROM items WHERE item_name = 'Pants')

UNION ALL

SELECT 
  'Sold' as location,
  COALESCE(SUM(s.quantity_sold), 0) as quantity
FROM sales s
WHERE s.item_id = (SELECT item_id FROM items WHERE item_name = 'Pants')

UNION ALL

SELECT 
  'Withdrawn' as location,
  COALESCE(SUM(sw.quantity_withdrawn), 0) as quantity
FROM stock_withdrawals sw
WHERE sw.item_id = (SELECT item_id FROM items WHERE item_name = 'Pants');

-- Check if there are any withdrawals
SELECT 
  'Withdrawals' as type,
  COUNT(*) as count,
  COALESCE(SUM(quantity_withdrawn), 0) as total_withdrawn
FROM stock_withdrawals
WHERE item_id = (SELECT item_id FROM items WHERE item_name = 'Pants');

-- Summary
SELECT 
  'Initial Stock' as description,
  62 as quantity
UNION ALL
SELECT 'Stock Additions', 93
UNION ALL
SELECT 'Total Available', 155
UNION ALL
SELECT 'Distributed to Stalls', 129
UNION ALL
SELECT 'Remaining at Hub', 26
UNION ALL
SELECT 'Sold', 86
UNION ALL
SELECT 'Total Accounted For', 129 + 86;
