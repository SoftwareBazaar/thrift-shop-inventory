-- Check the individual withdrawal records for baggy jeans
-- to see which one has the incorrect quantity

SELECT 
  sw.withdrawal_id,
  sw.item_id,
  sw.quantity_withdrawn,
  sw.reason,
  sw.date_withdrawn,
  sw.withdrawn_by,
  u.full_name as withdrawn_by_name
FROM stock_withdrawals sw
JOIN items i ON sw.item_id = i.item_id
LEFT JOIN users u ON sw.withdrawn_by = u.user_id
WHERE i.item_name ILIKE '%baggy%jean%'
  AND i.item_name NOT ILIKE '%men%'  -- Exclude "Baggy men's Jeans"
ORDER BY sw.date_withdrawn;

-- After identifying the incorrect withdrawal, you can either:

-- OPTION 1: Delete the incorrect withdrawal(s)
-- DELETE FROM stock_withdrawals WHERE withdrawal_id = <incorrect_id>;

-- OPTION 2: Update the incorrect quantity
-- UPDATE stock_withdrawals 
-- SET quantity_withdrawn = <correct_quantity>
-- WHERE withdrawal_id = <incorrect_id>;

-- Then run the fix-inventory-stock.sql script again to recalculate
