-- ============================================================================
-- Fix withdraw_stock_atomic to accept stall_id and distribution_id params
-- This resolves the "Failed to withdraw stock" false error on central withdrawals
-- ============================================================================

-- Drop old 5-argument version if it exists
DROP FUNCTION IF EXISTS withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT);

-- Create correct 7-argument version
CREATE OR REPLACE FUNCTION withdraw_stock_atomic(
    p_item_id        INTEGER,
    p_quantity       INTEGER,
    p_reason         TEXT,
    p_withdrawn_by   INTEGER,
    p_notes          TEXT    DEFAULT NULL,
    p_stall_id       INTEGER DEFAULT NULL,
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
        p_item_id, p_quantity,
        COALESCE(p_reason, 'General withdrawal'),
        p_withdrawn_by, p_notes,
        p_stall_id, p_distribution_id
    );

    v_item := recalc_item_stock(p_item_id);
    RETURN v_item;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO anon, authenticated;
