-- ============================================================================
-- Opening → change → closing on stock history rows
-- ============================================================================
-- Stores the balance at the location being changed when the action runs:
--   stock_additions     → central hub before/after
--   stock_distribution  → central hub before/after (per row)
--   stock_withdrawals   → hub before/after for hub takes;
--                         stall remaining before/after for stall→hub returns
-- Older rows stay NULL (UI shows "—").
-- ============================================================================

ALTER TABLE stock_additions
  ADD COLUMN IF NOT EXISTS stock_before INTEGER,
  ADD COLUMN IF NOT EXISTS stock_after INTEGER;

ALTER TABLE stock_distribution
  ADD COLUMN IF NOT EXISTS stock_before INTEGER,
  ADD COLUMN IF NOT EXISTS stock_after INTEGER;

ALTER TABLE stock_withdrawals
  ADD COLUMN IF NOT EXISTS stock_before INTEGER,
  ADD COLUMN IF NOT EXISTS stock_after INTEGER;

-- ----------------------------------------------------------------------------
-- Add stock: hub Opening → +qty → Closing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_stock_atomic(
  p_item_id INTEGER,
  p_quantity INTEGER,
  p_added_by INTEGER
)
RETURNS items
LANGUAGE plpgsql
AS $$
DECLARE
  v_item items;
  v_before INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity to add must be greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);
  v_before := compute_hub_stock(p_item_id);

  INSERT INTO stock_additions (item_id, quantity_added, added_by, stock_before, stock_after)
  VALUES (p_item_id, p_quantity, p_added_by, v_before, v_before + p_quantity);

  SELECT * INTO v_item FROM items WHERE item_id = p_item_id;
  RETURN v_item;
END;
$$;

-- ----------------------------------------------------------------------------
-- Hub withdrawal: hub Opening → −qty → Closing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION withdraw_stock_atomic(
  p_item_id INTEGER,
  p_quantity INTEGER,
  p_reason TEXT,
  p_withdrawn_by INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_stall_id INTEGER DEFAULT NULL,
  p_distribution_id INTEGER DEFAULT NULL
)
RETURNS items
LANGUAGE plpgsql
AS $$
DECLARE
  v_item items;
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  IF p_stall_id IS NOT NULL OR p_distribution_id IS NOT NULL THEN
    RAISE EXCEPTION 'Returning stock from a stall must use withdraw_from_distribution_atomic so the batch and the audit row stay together.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Withdrawal quantity must be greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);
  v_before := compute_hub_stock(p_item_id);
  v_after := GREATEST(0, v_before - p_quantity);

  INSERT INTO stock_withdrawals (
    item_id, quantity_withdrawn, reason, withdrawn_by, notes, stall_id, distribution_id,
    stock_before, stock_after
  )
  VALUES (
    p_item_id,
    p_quantity,
    COALESCE(p_reason, 'General withdrawal'),
    p_withdrawn_by,
    p_notes,
    NULL,
    NULL,
    v_before,
    v_after
  );

  SELECT * INTO v_item FROM items WHERE item_id = p_item_id;
  RETURN v_item;
END;
$$;

-- ----------------------------------------------------------------------------
-- Distribute: hub Opening → −qty → Closing (running balance across rows)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION distribute_stock_atomic_v2(
  p_item_id INTEGER,
  p_distributions JSONB,
  p_distributed_by INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS SETOF stock_distribution
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
  v_total INTEGER := 0;
  v_dist JSONB;
  v_running INTEGER;
  v_qty INTEGER;
  v_row stock_distribution;
BEGIN
  FOR v_dist IN SELECT * FROM jsonb_array_elements(p_distributions)
  LOOP
    IF COALESCE((v_dist->>'quantity')::INTEGER, 0) <= 0 THEN
      RAISE EXCEPTION 'Each distribution quantity must be greater than zero.';
    END IF;
    v_total := v_total + (v_dist->>'quantity')::INTEGER;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Distribution quantity must be greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);
  v_available := compute_hub_stock(p_item_id);

  IF v_available < v_total THEN
    RAISE EXCEPTION 'Only % left at the central hub. You asked to send %.',
      v_available, v_total;
  END IF;

  v_running := v_available;

  FOR v_dist IN SELECT * FROM jsonb_array_elements(p_distributions)
  LOOP
    v_qty := (v_dist->>'quantity')::INTEGER;

    INSERT INTO stock_distribution (
      item_id, stall_id, quantity_allocated, distributed_by, notes,
      stock_before, stock_after
    ) VALUES (
      p_item_id,
      (v_dist->>'stall_id')::INTEGER,
      v_qty,
      p_distributed_by,
      COALESCE(p_notes, ''),
      v_running,
      v_running - v_qty
    )
    RETURNING * INTO v_row;

    v_running := v_running - v_qty;
    RETURN NEXT v_row;
  END LOOP;

  RETURN;
END;
$$;

-- ----------------------------------------------------------------------------
-- Return one distribution batch: stall Opening → −qty → Closing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION withdraw_from_distribution_atomic(
  p_distribution_id INTEGER,
  p_quantity INTEGER,
  p_withdrawn_by INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id INTEGER;
  v_batch stock_distribution;
  v_withdrawal_id INTEGER;
  v_item items;
  v_stall_name TEXT;
  v_stall_left INTEGER;
  v_max INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  SELECT item_id INTO v_item_id
  FROM stock_distribution
  WHERE distribution_id = p_distribution_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Distribution batch not found. Please refresh and try again.';
  END IF;

  PERFORM lock_item(v_item_id);

  SELECT * INTO v_batch
  FROM stock_distribution
  WHERE distribution_id = p_distribution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Distribution batch not found. Please refresh and try again.';
  END IF;

  v_stall_left := stall_remaining(v_batch.item_id, v_batch.stall_id);
  v_max := LEAST(v_batch.quantity_allocated, GREATEST(v_stall_left, 0));

  IF p_quantity > v_max THEN
    RAISE EXCEPTION 'Only % unit(s) left to return from this stall (batch has %, unsold at stall %).',
      v_max, v_batch.quantity_allocated, GREATEST(v_stall_left, 0);
  END IF;

  UPDATE stock_distribution
  SET quantity_allocated = quantity_allocated - p_quantity
  WHERE distribution_id = p_distribution_id
    AND quantity_allocated = v_batch.quantity_allocated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This stock was just changed by someone else. Please refresh and try again.';
  END IF;

  INSERT INTO stock_withdrawals (
    item_id, stall_id, distribution_id, quantity_withdrawn, reason, notes, withdrawn_by,
    stock_before, stock_after
  ) VALUES (
    v_batch.item_id,
    v_batch.stall_id,
    p_distribution_id,
    p_quantity,
    'Returned to central hub',
    'Returned ' || p_quantity || ' units from stall to central hub.',
    p_withdrawn_by,
    GREATEST(v_stall_left, 0),
    GREATEST(v_stall_left - p_quantity, 0)
  )
  RETURNING withdrawal_id INTO v_withdrawal_id;

  SELECT stall_name INTO v_stall_name FROM stalls WHERE stall_id = v_batch.stall_id;
  SELECT * INTO v_item FROM items WHERE item_id = v_batch.item_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawnQuantity', p_quantity,
    'withdrawalId', v_withdrawal_id,
    'stallName', v_stall_name,
    'itemId', v_batch.item_id,
    'newCentralStock', v_item.current_stock
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Stall → hub (possibly multi-batch): stall Opening → −qty → Closing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION withdraw_from_stall_atomic(
  p_item_id INTEGER,
  p_stall_id INTEGER,
  p_quantity INTEGER,
  p_withdrawn_by INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
  v_remaining INTEGER;
  v_take INTEGER;
  v_batch stock_distribution;
  v_withdrawal_id INTEGER;
  v_item items;
  v_stall_name TEXT;
  v_parts JSONB := '[]'::JSONB;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Withdrawal quantity must be a whole number greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);

  PERFORM 1
  FROM stock_distribution
  WHERE item_id = p_item_id AND stall_id = p_stall_id
  FOR UPDATE;

  v_available := stall_remaining(p_item_id, p_stall_id);

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Only % left at this stall. You asked to withdraw %.',
      GREATEST(v_available, 0), p_quantity;
  END IF;

  INSERT INTO stock_withdrawals (
    item_id, stall_id, distribution_id, quantity_withdrawn, reason, notes, withdrawn_by,
    stock_before, stock_after
  ) VALUES (
    p_item_id,
    p_stall_id,
    NULL,
    p_quantity,
    COALESCE(p_reason, 'Returned to central hub'),
    COALESCE(p_notes, 'Moved from stall back to central hub'),
    p_withdrawn_by,
    GREATEST(v_available, 0),
    GREATEST(v_available - p_quantity, 0)
  )
  RETURNING withdrawal_id INTO v_withdrawal_id;

  v_remaining := p_quantity;

  FOR v_batch IN
    SELECT *
    FROM stock_distribution
    WHERE item_id = p_item_id
      AND stall_id = p_stall_id
      AND quantity_allocated > 0
    ORDER BY date_distributed ASC, distribution_id ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.quantity_allocated);

    UPDATE stock_distribution
    SET quantity_allocated = quantity_allocated - v_take
    WHERE distribution_id = v_batch.distribution_id
      AND quantity_allocated = v_batch.quantity_allocated;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'This stock was just changed by someone else. Please refresh and try again.';
    END IF;

    INSERT INTO stock_withdrawal_batches (
      withdrawal_id, distribution_id, quantity_withdrawn
    ) VALUES (
      v_withdrawal_id, v_batch.distribution_id, v_take
    );

    v_parts := v_parts || jsonb_build_array(
      jsonb_build_object(
        'distributionId', v_batch.distribution_id,
        'quantity', v_take
      )
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Only % left at this stall. You asked to withdraw %.',
      p_quantity - v_remaining, p_quantity;
  END IF;

  SELECT stall_name INTO v_stall_name FROM stalls WHERE stall_id = p_stall_id;
  SELECT * INTO v_item FROM items WHERE item_id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawnQuantity', p_quantity,
    'withdrawalId', v_withdrawal_id,
    'stallName', v_stall_name,
    'itemId', p_item_id,
    'newCentralStock', v_item.current_stock,
    'batchParts', v_parts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION add_stock_atomic(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION distribute_stock_atomic_v2(INTEGER, JSONB, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_distribution_atomic(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_stall_atomic(INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO anon, authenticated;
