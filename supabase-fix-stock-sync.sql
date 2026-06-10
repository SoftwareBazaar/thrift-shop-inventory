-- ============================================================================
-- FIX: Stock synchronization bugs (run this in Supabase SQL Editor)
-- ============================================================================
-- Fixes:
--   1. "Added 51 but system captured 39"  -> atomic, delta-based stock additions
--   2. "History shows addition but Available to Distribute doesn't update"
--      -> totals are always recomputed from history inside one transaction
--   3. "Cannot withdraw from central"     -> withdraw_stock_atomic RPC
--   4. Removes triggers that corrupt/block stock:
--      - trigger_update_current_stock (deducted central stock on STALL sales)
--      - trigger_validate_allocation  (double-counted allocations, blocked
--        valid distributions)
--   5. One-time repair of items.total_added / total_allocated / current_stock
--      from the history tables.
--
-- Formula used everywhere (single source of truth):
--   total_added     = SUM(stock_additions.quantity_added)
--   total_allocated = SUM(stock_distribution.quantity_allocated)
--   current_stock   = initial_stock + total_added - total_allocated
--                     - central sales (stall_id IS NULL) - withdrawals
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Remove harmful triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_update_current_stock ON sales;
DROP TRIGGER IF EXISTS trigger_deduct_sales_stock ON sales;
DROP TRIGGER IF EXISTS trigger_validate_allocation ON stock_distribution;

-- ----------------------------------------------------------------------------
-- 1. Helper: recompute one item's totals from history (caller must hold lock)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalc_item_stock(p_item_id INTEGER)
RETURNS items AS $$
DECLARE
    v_item items;
    v_added INTEGER;
    v_allocated INTEGER;
    v_central_sold INTEGER;
    v_withdrawn INTEGER;
BEGIN
    SELECT COALESCE(SUM(quantity_added), 0) INTO v_added
    FROM stock_additions WHERE item_id = p_item_id;

    SELECT COALESCE(SUM(quantity_allocated), 0) INTO v_allocated
    FROM stock_distribution WHERE item_id = p_item_id;

    SELECT COALESCE(SUM(quantity_sold), 0) INTO v_central_sold
    FROM sales WHERE item_id = p_item_id AND stall_id IS NULL;

    SELECT COALESCE(SUM(quantity_withdrawn), 0) INTO v_withdrawn
    FROM stock_withdrawals WHERE item_id = p_item_id;

    UPDATE items
    SET total_added     = v_added,
        total_allocated = v_allocated,
        current_stock   = GREATEST(0,
            COALESCE(initial_stock, 0) + v_added - v_allocated
            - v_central_sold - v_withdrawn)
    WHERE item_id = p_item_id
    RETURNING * INTO v_item;

    IF v_item.item_id IS NULL THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Atomic ADD STOCK (delta-based: pass exactly what the user typed)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_stock_atomic(
    p_item_id INTEGER,
    p_quantity INTEGER,
    p_added_by INTEGER
)
RETURNS items AS $$
DECLARE
    v_item items;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity to add must be greater than zero';
    END IF;

    -- Lock the item row so concurrent operations queue up instead of racing
    PERFORM 1 FROM items WHERE item_id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    INSERT INTO stock_additions (item_id, quantity_added, added_by)
    VALUES (p_item_id, p_quantity, p_added_by);

    v_item := recalc_item_stock(p_item_id);
    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. Atomic WITHDRAW from central hub
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION withdraw_stock_atomic(
    p_item_id INTEGER,
    p_quantity INTEGER,
    p_reason TEXT,
    p_withdrawn_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS items AS $$
DECLARE
    v_item items;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Withdrawal quantity must be greater than zero';
    END IF;

    PERFORM 1 FROM items WHERE item_id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    -- Recompute available stock from history before validating
    v_item := recalc_item_stock(p_item_id);

    IF v_item.current_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %',
            v_item.current_stock, p_quantity;
    END IF;

    INSERT INTO stock_withdrawals (item_id, quantity_withdrawn, reason, withdrawn_by, notes)
    VALUES (p_item_id, p_quantity, COALESCE(p_reason, 'General withdrawal'), p_withdrawn_by, p_notes);

    v_item := recalc_item_stock(p_item_id);
    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. Atomic DISTRIBUTE to one or more stalls
--    p_distributions: JSON array like [{"stall_id":1,"quantity":5}, ...]
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION distribute_stock_atomic_v2(
    p_item_id INTEGER,
    p_distributions JSONB,
    p_distributed_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS SETOF stock_distribution AS $$
DECLARE
    v_item items;
    v_total INTEGER := 0;
    v_dist JSONB;
BEGIN
    -- Validate payload and compute total
    FOR v_dist IN SELECT * FROM jsonb_array_elements(p_distributions)
    LOOP
        IF COALESCE((v_dist->>'quantity')::INTEGER, 0) <= 0 THEN
            RAISE EXCEPTION 'Each distribution quantity must be greater than zero';
        END IF;
        v_total := v_total + (v_dist->>'quantity')::INTEGER;
    END LOOP;

    IF v_total <= 0 THEN
        RAISE EXCEPTION 'Distribution quantity must be greater than zero';
    END IF;

    PERFORM 1 FROM items WHERE item_id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    -- Recompute available stock from history before validating
    v_item := recalc_item_stock(p_item_id);

    IF v_item.current_stock < v_total THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %',
            v_item.current_stock, v_total;
    END IF;

    RETURN QUERY
    INSERT INTO stock_distribution (item_id, stall_id, quantity_allocated, distributed_by, notes)
    SELECT
        p_item_id,
        (d->>'stall_id')::INTEGER,
        (d->>'quantity')::INTEGER,
        p_distributed_by,
        COALESCE(p_notes, '')
    FROM jsonb_array_elements(p_distributions) AS d
    RETURNING *;

    PERFORM recalc_item_stock(p_item_id);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. Allow the app (anon/authenticated keys) to call these functions
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION recalc_item_stock(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_stock_atomic(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION distribute_stock_atomic_v2(INTEGER, JSONB, INTEGER, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. ONE-TIME REPAIR: re-sync every item's totals from history right now
-- ----------------------------------------------------------------------------
UPDATE items i
SET total_added     = h.added,
    total_allocated = h.allocated,
    current_stock   = GREATEST(0,
        COALESCE(i.initial_stock, 0) + h.added - h.allocated
        - h.central_sold - h.withdrawn)
FROM (
    SELECT
        it.item_id,
        COALESCE(sa.added, 0)        AS added,
        COALESCE(sd.allocated, 0)    AS allocated,
        COALESCE(cs.central_sold, 0) AS central_sold,
        COALESCE(sw.withdrawn, 0)    AS withdrawn
    FROM items it
    LEFT JOIN (SELECT item_id, SUM(quantity_added) AS added
               FROM stock_additions GROUP BY item_id) sa ON sa.item_id = it.item_id
    LEFT JOIN (SELECT item_id, SUM(quantity_allocated) AS allocated
               FROM stock_distribution GROUP BY item_id) sd ON sd.item_id = it.item_id
    LEFT JOIN (SELECT item_id, SUM(quantity_sold) AS central_sold
               FROM sales WHERE stall_id IS NULL GROUP BY item_id) cs ON cs.item_id = it.item_id
    LEFT JOIN (SELECT item_id, SUM(quantity_withdrawn) AS withdrawn
               FROM stock_withdrawals GROUP BY item_id) sw ON sw.item_id = it.item_id
) h
WHERE h.item_id = i.item_id;

-- Optional sanity check: see items whose stored totals disagreed with history
-- (run before/after to compare)
SELECT item_id, item_name, initial_stock, total_added, total_allocated, current_stock
FROM items
ORDER BY item_name;
