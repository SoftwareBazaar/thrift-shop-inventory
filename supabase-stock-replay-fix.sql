-- ============================================================================
-- FIX: Central stock replay (no deficit holes from historical over-withdrawals)
-- ============================================================================
-- Problem: SUM(additions) - SUM(withdrawals) - ... can go negative internally.
--          Future additions are "absorbed" filling the hole before showing as
--          Available to distribute.
--
-- Solution: Replay all central-hub events in time order. Deductions never
--           reduce running balance below 0. Withdrawal/distribution rows stay
--           in history unchanged; only the *effect* on current_stock changes.
--
--   total_added     = SUM(stock_additions)           (unchanged)
--   total_allocated = SUM(stock_distribution)        (unchanged)
--   current_stock   = replay(initial + adds - dists - sales - withdraws, floor 0)
-- ============================================================================

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
            SELECT date_added AS ts, 1 AS kind_order, addition_id AS sort_id,
                   'add'::text AS kind, quantity_added AS qty
            FROM stock_additions WHERE item_id = p_item_id
            UNION ALL
            SELECT date_time, 2, sale_id, 'sale', quantity_sold
            FROM sales WHERE item_id = p_item_id AND stall_id IS NULL
            UNION ALL
            SELECT date_withdrawn, 3, withdrawal_id, 'withdraw', quantity_withdrawn
            FROM stock_withdrawals WHERE item_id = p_item_id
            UNION ALL
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

CREATE OR REPLACE FUNCTION recalc_item_stock(p_item_id INTEGER)
RETURNS items AS $$
DECLARE
    v_item items;
    v_added INTEGER;
    v_allocated INTEGER;
BEGIN
    SELECT COALESCE(SUM(quantity_added), 0) INTO v_added
    FROM stock_additions WHERE item_id = p_item_id;

    SELECT COALESCE(SUM(quantity_allocated), 0) INTO v_allocated
    FROM stock_distribution WHERE item_id = p_item_id;

    UPDATE items
    SET total_added     = v_added,
        total_allocated = v_allocated,
        current_stock   = compute_central_stock_replay(p_item_id)
    WHERE item_id = p_item_id
    RETURNING * INTO v_item;

    IF v_item.item_id IS NULL THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

-- Withdrawals are always recorded; replay caps their effect at available stock
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

    INSERT INTO stock_withdrawals (item_id, quantity_withdrawn, reason, withdrawn_by, notes)
    VALUES (p_item_id, p_quantity, COALESCE(p_reason, 'General withdrawal'), p_withdrawn_by, p_notes);

    v_item := recalc_item_stock(p_item_id);
    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION distribute_stock_atomic_v2(
    p_item_id INTEGER,
    p_distributions JSONB,
    p_distributed_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS SETOF stock_distribution AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER := 0;
    v_dist JSONB;
BEGIN
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

    v_available := compute_central_stock_replay(p_item_id);

    IF v_available < v_total THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %',
            v_available, v_total;
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

GRANT EXECUTE ON FUNCTION compute_central_stock_replay(INTEGER) TO anon, authenticated;

-- Re-sync every item with the new replay formula
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT item_id FROM items LOOP
        PERFORM recalc_item_stock(r.item_id);
    END LOOP;
END $$;

SELECT item_id, item_name, total_added, total_allocated, current_stock
FROM items
WHERE item_id IN (50, 80, 96)
ORDER BY item_id;
