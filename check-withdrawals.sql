-- Simple check: What's the total quantity withdrawn for baggy jeans?
SELECT 
  i.item_name,
  COALESCE(SUM(sw.quantity_withdrawn), 0) as total_withdrawn_quantity,
  COUNT(sw.withdrawal_id) as withdrawal_count
FROM items i
LEFT JOIN stock_withdrawals sw ON i.item_id = sw.item_id
WHERE i.item_name ILIKE '%baggy%jean%'
GROUP BY i.item_id, i.item_name;

-- If the result shows a high withdrawal quantity, that's why stock is 0
-- Expected: If total_withdrawn_quantity = 21, then:
--   60 (received) - 39 (distributed) - 0 (central sales) - 21 (withdrawn) = 0 ✓
