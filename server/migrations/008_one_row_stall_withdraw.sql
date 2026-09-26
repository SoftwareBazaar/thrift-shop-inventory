-- ============================================================================
-- One history row per stall→hub return (no more -2 / -29 / -2 bits)
-- ============================================================================
-- Stock still drains oldest distribution batches first. The audit trail is now
-- ONE stock_withdrawals row for the total, plus detail rows that keep the hub
-- ledger able to rebuild each batch's original allocation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_withdrawal_batches (
  batch_link_id SERIAL PRIMARY KEY,
  withdrawal_id INTEGER NOT NULL
    REFERENCES stock_withdrawals(withdrawal_id) ON DELETE CASCADE,
  distribution_id INTEGER NOT NULL
    REFERENCES stock_distribution(distribution_id),
  quantity_withdrawn INTEGER NOT NULL CHECK (quantity_withdrawn > 0)
);

CREATE INDEX IF NOT EXISTS idx_swb_withdrawal
  ON stock_withdrawal_batches(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_swb_distribution
  ON stock_withdrawal_batches(distribution_id);

GRANT SELECT, INSERT, DELETE ON stock_withdrawal_batches TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE stock_withdrawal_batches_batch_link_id_seq TO anon, authenticated;

-- Hub ledger: credit batch-detail amounts onto the right distribution rows.
CREATE OR REPLACE FUNCTION compute_hub_stock(p_item_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hub INTEGER;
  v_initial INTEGER;
  r RECORD;
BEGIN
  SELECT COALESCE(initial_stock, 0) INTO v_initial
  FROM items
  WHERE item_id = p_item_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_hub := v_initial;

  FOR r IN
    WITH
    dists AS (
      SELECT
        distribution_id,
        stall_id,
        COALESCE(quantity_allocated, 0) AS qty,
        date_distributed
      FROM stock_distribution
      WHERE item_id = p_item_id
        AND date_distributed IS NOT NULL
    ),
    stall_returns AS (
      SELECT
        withdrawal_id,
        stall_id,
        distribution_id,
        COALESCE(quantity_withdrawn, 0) AS qty,
        date_withdrawn
      FROM stock_withdrawals
      WHERE item_id = p_item_id
        AND stall_id IS NOT NULL
        AND date_withdrawn IS NOT NULL
    ),
    return_parts AS (
      SELECT
        b.withdrawal_id,
        b.distribution_id,
        COALESCE(b.quantity_withdrawn, 0) AS qty
      FROM stock_withdrawal_batches b
      INNER JOIN stall_returns sr ON sr.withdrawal_id = b.withdrawal_id
    ),
    linked AS (
      SELECT
        d.distribution_id,
        d.stall_id,
        d.qty
          + COALESCE((
              SELECT SUM(sr.qty)
              FROM stall_returns sr
              WHERE sr.distribution_id = d.distribution_id
            ), 0)
          + COALESCE((
              SELECT SUM(rp.qty)
              FROM return_parts rp
              WHERE rp.distribution_id = d.distribution_id
            ), 0) AS original_qty,
        d.date_distributed
      FROM dists d
    ),
    unlinked AS (
      SELECT sr.*
      FROM stall_returns sr
      WHERE NOT EXISTS (
          SELECT 1 FROM return_parts rp WHERE rp.withdrawal_id = sr.withdrawal_id
        )
        AND (
          sr.distribution_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM dists d WHERE d.distribution_id = sr.distribution_id
          )
        )
    ),
    unlinked_target AS (
      SELECT
        u.qty,
        (
          SELECT d.distribution_id
          FROM dists d
          WHERE d.stall_id = u.stall_id
            AND d.date_distributed <= u.date_withdrawn
          ORDER BY d.date_distributed ASC, d.distribution_id ASC
          LIMIT 1
        ) AS distribution_id
      FROM unlinked u
    ),
    original AS (
      SELECT
        l.distribution_id,
        l.original_qty + COALESCE((
          SELECT SUM(t.qty)
          FROM unlinked_target t
          WHERE t.distribution_id = l.distribution_id
        ), 0) AS original_qty,
        l.date_distributed
      FROM linked l
    ),
    events AS (
      SELECT date_added AS ts, 1 AS kind_order, addition_id AS sort_id,
             'add'::text AS kind, quantity_added AS qty
      FROM stock_additions
      WHERE item_id = p_item_id AND date_added IS NOT NULL

      UNION ALL
      SELECT date_withdrawn, 2, withdrawal_id, 'return', quantity_withdrawn
      FROM stock_withdrawals
      WHERE item_id = p_item_id AND stall_id IS NOT NULL AND date_withdrawn IS NOT NULL

      UNION ALL
      SELECT date_time, 3, sale_id, 'sale', quantity_sold
      FROM sales
      WHERE item_id = p_item_id AND stall_id IS NULL AND date_time IS NOT NULL

      UNION ALL
      SELECT date_withdrawn, 4, withdrawal_id, 'withdraw', quantity_withdrawn
      FROM stock_withdrawals
      WHERE item_id = p_item_id AND stall_id IS NULL AND date_withdrawn IS NOT NULL

      UNION ALL
      SELECT date_distributed, 5, distribution_id, 'dist', original_qty
      FROM original
    )
    SELECT kind, qty
    FROM events
    ORDER BY ts ASC, kind_order ASC, sort_id ASC
  LOOP
    IF r.kind IN ('add', 'return') THEN
      v_hub := v_hub + r.qty;
    ELSE
      v_hub := GREATEST(0, v_hub - r.qty);
    END IF;
  END LOOP;

  RETURN GREATEST(0, v_hub);
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

  -- One audit row for the whole action (history shows a single -N).
  INSERT INTO stock_withdrawals (
    item_id, stall_id, distribution_id, quantity_withdrawn, reason, notes, withdrawn_by
  ) VALUES (
    p_item_id,
    p_stall_id,
    NULL,
    p_quantity,
    COALESCE(p_reason, 'Returned to central hub'),
    COALESCE(p_notes, 'Moved from stall back to central hub'),
    p_withdrawn_by
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

GRANT EXECUTE ON FUNCTION withdraw_from_stall_atomic(INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_hub_stock(INTEGER) TO anon, authenticated;
