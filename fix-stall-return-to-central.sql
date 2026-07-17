-- ============================================================================
-- FIX: Stall withdrawals must NOT reduce central stock in compute_central_stock_replay
-- When stock is returned from a stall:
--   - The stock_distribution row is reduced/deleted  (lowers "Out at stalls")
--   - A stock_withdrawals row with stall_id IS NOT NULL is inserted (audit trail)
--   - Central available = initial + added - allocated - central_sales - central_withdrawals
--   - stall_id IS NOT NULL withdrawals must be IGNORED by the central replay
-- ============================================================================

-- Fix compute_central_stock_replay to exclude stall-return withdrawals
CREATE OR REPLACE FUNCTION compute_central_stock_replay(p_item_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_central INTEGER;
    v_initial INTEGER;
    r RECORD;
BEGIN
    SELECT COALESCE(initial_stock, 0) INTO v_initial
    FROM items WHERE item_id = p_item_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_central := v_initial;

    FOR r IN
        SELECT ts, kind, qty
        FROM (
            -- Stock additions increase central
            SELECT date_added AS ts, 1 AS kind_order, addition_id AS sort_id,
                   'add'::text AS kind, quantity_added AS qty
            FROM stock_additions WHERE item_id = p_item_id
            UNION ALL
            -- Central sales (stall_id IS NULL) reduce central
            SELECT date_time, 2, sale_id, 'sale', quantity_sold
            FROM sales WHERE item_id = p_item_id AND stall_id IS NULL
            UNION ALL
            -- ONLY central-hub withdrawals (stall_id IS NULL) reduce central.
            -- Stall returns (stall_id IS NOT NULL) are audit-only here;
            -- their effect is captured by the distribution row being reduced/deleted.
            SELECT date_withdrawn, 3, withdrawal_id, 'withdraw', quantity_withdrawn
            FROM stock_withdrawals
            WHERE item_id = p_item_id AND stall_id IS NULL
            UNION ALL
            -- Distributions reduce central (allocated to stalls)
            SELECT date_distributed, 4, distribution_id, 'dist', quantity_allocated
            FROM stock_distribution WHERE item_id = p_item_id
        ) e
        ORDER BY ts ASC, kind_order ASC, sort_id ASC
    LOOP
        IF r.kind = 'add' THEN
            v_central := v_central + r.qty;
        ELSE
            v_central := GREATEST(0, v_central - r.qty);
        END IF;
    END LOOP;

    RETURN v_central;
END;
$$ LANGUAGE plpgsql;

-- Re-sync every item immediately with the corrected formula
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT item_id FROM items LOOP
        PERFORM recalc_item_stock(r.item_id);
    END LOOP;
END $$;

-- Verify Corduroy specifically (update item_id 9 if that matches)
SELECT item_id, item_name, initial_stock, total_added, total_allocated, current_stock
FROM items
ORDER BY item_name;
