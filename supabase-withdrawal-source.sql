-- ============================================================================
-- Withdrawal source tracking: show whether withdrawn from Central or a Stall
-- ============================================================================
-- stall_id IS NULL     -> owner withdrawal from central hub (affects central replay)
-- stall_id IS NOT NULL -> withdrawn from that stall (audit only; stall qty handled
--                         via stock_distribution reduction / return to central)
-- ============================================================================

ALTER TABLE stock_withdrawals
  ADD COLUMN IF NOT EXISTS stall_id INTEGER REFERENCES stalls(stall_id),
  ADD COLUMN IF NOT EXISTS distribution_id INTEGER REFERENCES stock_distribution(distribution_id);

CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_stall_id ON stock_withdrawals(stall_id);

-- Replace older 5-argument signature
DROP FUNCTION IF EXISTS withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT);

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
            -- Only CENTRAL-hub withdrawals reduce available-to-distribute
            SELECT date_withdrawn, 3, withdrawal_id, 'withdraw', quantity_withdrawn
            FROM stock_withdrawals
            WHERE item_id = p_item_id AND stall_id IS NULL
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

CREATE OR REPLACE FUNCTION withdraw_stock_atomic(
    p_item_id INTEGER,
    p_quantity INTEGER,
    p_reason TEXT,
    p_withdrawn_by INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_stall_id INTEGER DEFAULT NULL,
    p_distribution_id INTEGER DEFAULT NULL
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

    INSERT INTO stock_withdrawals (
        item_id, quantity_withdrawn, reason, withdrawn_by, notes, stall_id, distribution_id
    )
    VALUES (
        p_item_id, p_quantity, COALESCE(p_reason, 'General withdrawal'), p_withdrawn_by,
        p_notes, p_stall_id, p_distribution_id
    );

    v_item := recalc_item_stock(p_item_id);
    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- Re-sync all items with updated replay (central-only withdrawals)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT item_id FROM items LOOP
        PERFORM recalc_item_stock(r.item_id);
    END LOOP;
END $$;
