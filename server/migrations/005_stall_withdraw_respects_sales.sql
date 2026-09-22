-- ============================================================================
-- Fix: stall returns must not invent hub stock
-- ============================================================================
-- Sales leave quantity_allocated unchanged. Withdrawing used to check only
-- the batch size, so after selling everything at a stall you could still
-- "return" those units to the hub. Same class of bug for deleting or
-- shrinking a distribution below what has already been sold there.
-- ============================================================================

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

  -- Unsold left at the stall, not the raw batch size. Selling does not shrink
  -- quantity_allocated, so the batch can look full after everything sold.
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
    item_id, stall_id, distribution_id, quantity_withdrawn, reason, notes, withdrawn_by
  ) VALUES (
    v_batch.item_id,
    v_batch.stall_id,
    p_distribution_id,
    p_quantity,
    'Returned to central hub',
    'Returned ' || p_quantity || ' units from stall to central hub.',
    p_withdrawn_by
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
  v_primary_id INTEGER;
  v_item items;
  v_stall_name TEXT;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Withdrawal quantity must be a whole number greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);

  PERFORM 1
  FROM stock_distribution
  WHERE item_id = p_item_id AND stall_id = p_stall_id
  FOR UPDATE;

  -- Unsold at the stall = allocated − sold. Never return sold units to the hub.
  v_available := stall_remaining(p_item_id, p_stall_id);

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Only % left at this stall. You asked to withdraw %.',
      GREATEST(v_available, 0), p_quantity;
  END IF;

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

    INSERT INTO stock_withdrawals (
      item_id, stall_id, distribution_id, quantity_withdrawn, reason, notes, withdrawn_by
    ) VALUES (
      p_item_id,
      p_stall_id,
      v_batch.distribution_id,
      v_take,
      COALESCE(p_reason, 'Returned to central hub'),
      COALESCE(p_notes, 'Moved from stall back to central hub'),
      p_withdrawn_by
    )
    RETURNING withdrawal_id INTO v_primary_id;

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
    'withdrawalId', v_primary_id,
    'stallName', v_stall_name,
    'itemId', p_item_id,
    'newCentralStock', v_item.current_stock
  );
END;
$$;

GRANT EXECUTE ON FUNCTION withdraw_from_distribution_atomic(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_stall_atomic(INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO anon, authenticated;
