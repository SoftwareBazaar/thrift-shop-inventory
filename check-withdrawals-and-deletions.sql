-- Check Stock Withdrawals History with Categories
SELECT 
  i.item_id,
  i.item_name,
  i.category,
  sw.quantity_withdrawn,
  sw.reason,
  sw.date_withdrawn,
  u.username as withdrawn_by
FROM stock_withdrawals sw
JOIN items i ON sw.item_id = i.item_id
LEFT JOIN auth.users u ON sw.withdrawn_by = u.id
ORDER BY sw.date_withdrawn DESC;

-- Check if there's a deletion history table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%delete%' OR table_name LIKE '%trash%';

-- Check items that might have been soft-deleted (if there's a deleted_at column)
SELECT 
  item_id,
  item_name,
  category,
  current_stock,
  deleted_at
FROM items
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Summary of withdrawals by category
SELECT 
  i.category,
  COUNT(sw.withdrawal_id) as total_withdrawals,
  SUM(sw.quantity_withdrawn) as total_quantity_withdrawn,
  MIN(sw.date_withdrawn) as first_withdrawal,
  MAX(sw.date_withdrawn) as last_withdrawal
FROM stock_withdrawals sw
JOIN items i ON sw.item_id = i.item_id
GROUP BY i.category
ORDER BY total_quantity_withdrawn DESC;

-- Check for any audit logs or activity history
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%audit%' OR table_name LIKE '%log%' OR table_name LIKE '%history%');
