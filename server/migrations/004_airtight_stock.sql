-- ============================================================================
-- Airtight stock enforcement
--
-- The app used to check stock in the browser, then write the sale. Two phones
-- could both pass that check and both write, overselling the stall or the hub.
--
-- This migration moves the check into Postgres:
--   1. The hub figure is the same time-ordered ledger the UI uses.
--   2. Every sale, distribution and hub withdrawal locks the item row first,
--      so concurrent writes queue instead of racing.
--   3. A sale that would oversell is rejected by a trigger even if the client
--      bypasses the RPC.
--   4. Recording a credit sale, and returning stock from a stall, happen in
--      one database transaction so a half-finished write cannot exist.
-- ============================================================================

-- Harmful leftovers: stall sales used to deduct hub stock; stall returns used
-- to be treated as hub withdrawals; allocation triggers double-counted.
DROP TRIGGER IF EXISTS trigger_update_current_stock ON sales;
DROP TRIGGER IF EXISTS trigger_deduct_sales_stock ON sales;
DROP TRIGGER IF EXISTS trigger_validate_allocation ON stock_distribution;
DROP TRIGGER IF EXISTS validate_allocation_trigger ON stock_distribution;
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON stock_withdrawals;
DROP TRIGGER IF EXISTS update_stock_after_withdrawal_trigger ON stock_withdrawals;
DROP TRIGGER IF EXISTS enforce_sale_stock_trigger ON sales;
DROP TRIGGER IF EXISTS enforce_distribution_stock_trigger ON stock_distribution;
DROP TRIGGER IF EXISTS enforce_hub_withdrawal_trigger ON stock_withdrawals;
DROP TRIGGER IF EXISTS recalc_after_hub_sale ON sales;
DROP TRIGGER IF EXISTS recalc_after_distribution ON stock_distribution;
DROP TRIGGER IF EXISTS recalc_after_addition ON stock_additions;
DROP TRIGGER IF EXISTS recalc_after_withdrawal ON stock_withdrawals;

DROP FUNCTION IF EXISTS withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS create_sale_atomic(INTEGER, INTEGER, DECIMAL, DECIMAL, INTEGER, VARCHAR, INTEGER, VARCHAR, VARCHAR, DATE, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_sale_atomic(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, VARCHAR, INTEGER, NUMERIC, NUMERIC, VARCHAR, VARCHAR, NUMERIC, DATE, TEXT);
DROP FUNCTION IF EXISTS withdraw_from_distribution_atomic(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS withdraw_from_stall_atomic(INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT);

-- Empty batches must be allowed to stay (a full stall return shrinks the row
-- to 0 rather than deleting it, because withdrawal rows still point at it).
ALTER TABLE stock_distribution DROP CONSTRAINT IF EXISTS check_quantity_allocated_positive;
ALTER TABLE stock_distribution DROP CONSTRAINT IF EXISTS check_quantity_allocated;
ALTER TABLE stock_distribution DROP CONSTRAINT IF EXISTS check_quantity_allocated_non_negative;
ALTER TABLE stock_distribution
  ADD CONSTRAINT check_quantity_allocated_non_negative CHECK (quantity_allocated >= 0);

ALTER TABLE sales DROP CONSTRAINT IF EXISTS check_quantity_sold_positive;
ALTER TABLE sales
  ADD CONSTRAINT check_quantity_sold_positive CHECK (quantity_sold > 0);

ALTER TABLE stock_additions DROP CONSTRAINT IF EXISTS check_quantity_added_positive;
ALTER TABLE stock_additions
  ADD CONSTRAINT check_quantity_added_positive CHECK (quantity_added > 0);

ALTER TABLE stock_withdrawals DROP CONSTRAINT IF EXISTS check_quantity_withdrawn_positive;
ALTER TABLE stock_withdrawals DROP CONSTRAINT IF EXISTS check_quantity_withdrawn;
ALTER TABLE stock_withdrawals
  ADD CONSTRAINT check_quantity_withdrawn_positive CHECK (quantity_withdrawn > 0);

ALTER TABLE items DROP CONSTRAINT IF EXISTS check_current_stock_non_negative;
ALTER TABLE items
  ADD CONSTRAINT check_current_stock_non_negative CHECK (current_stock >= 0);

-- ----------------------------------------------------------------------------
-- Hub ledger. Must stay in lock-step with client/src/utils/stockReplay.ts.
-- Credits (additions, stall returns) before debits in the same second.
-- Deductions floor at 0 at the moment they happen.
-- Stall returns are rebuilt onto the distribution they came from, because
-- that row was shrunk in place and no longer shows what originally left.
-- ----------------------------------------------------------------------------
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
    linked AS (
      SELECT
        d.distribution_id,
        d.stall_id,
        d.qty + COALESCE((
          SELECT SUM(sr.qty)
          FROM stall_returns sr
          WHERE sr.distribution_id = d.distribution_id
        ), 0) AS original_qty,
        d.date_distributed
      FROM dists d
    ),
    unlinked AS (
      SELECT sr.*
      FROM stall_returns sr
      WHERE sr.distribution_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM dists d WHERE d.distribution_id = sr.distribution_id
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
      v_hub := v_hub + COALESCE(r.qty, 0);
    ELSE
      v_hub := GREATEST(0, v_hub - COALESCE(r.qty, 0));
    END IF;
  END LOOP;

  RETURN GREATEST(0, v_hub);
END;
$$;

-- Older RPCs still call this name.
CREATE OR REPLACE FUNCTION compute_central_stock_replay(p_item_id INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT compute_hub_stock(p_item_id);
$$;

CREATE OR REPLACE FUNCTION stall_remaining(p_item_id INTEGER, p_stall_id INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE((
      SELECT SUM(quantity_allocated)
      FROM stock_distribution
      WHERE item_id = p_item_id AND stall_id = p_stall_id
    ), 0)
    -
    COALESCE((
      SELECT SUM(quantity_sold)
      FROM sales
      WHERE item_id = p_item_id AND stall_id = p_stall_id
    ), 0);
$$;

CREATE OR REPLACE FUNCTION lock_item(p_item_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM items WHERE item_id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION recalc_item_stock(p_item_id INTEGER)
RETURNS items
LANGUAGE plpgsql
AS $$
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
      current_stock   = compute_hub_stock(p_item_id)
  WHERE item_id = p_item_id
  RETURNING * INTO v_item;

  IF v_item.item_id IS NULL THEN
    RAISE EXCEPTION 'Item % not found', p_item_id;
  END IF;

  RETURN v_item;
END;
$$;

-- ----------------------------------------------------------------------------
-- Triggers: last line of defence. The RPCs call these same checks; the
-- trigger still fires if someone writes the tables directly.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
  v_allocated INTEGER;
  v_sold INTEGER;
BEGIN
  IF NEW.quantity_sold IS NULL OR NEW.quantity_sold <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  PERFORM lock_item(NEW.item_id);

  IF NEW.stall_id IS NULL THEN
    v_available := compute_hub_stock(NEW.item_id);
    IF TG_OP = 'UPDATE' AND OLD.stall_id IS NULL AND OLD.item_id = NEW.item_id THEN
      -- The row is still in the table as a hub sale, so the ledger already
      -- deducted OLD.quantity_sold. Credit it back for the comparison.
      v_available := v_available + COALESCE(OLD.quantity_sold, 0);
    END IF;
    IF v_available < NEW.quantity_sold THEN
      RAISE EXCEPTION 'Only % left at the central hub. You asked to sell %.',
        v_available, NEW.quantity_sold;
    END IF;
  ELSE
    PERFORM 1
    FROM stock_distribution
    WHERE item_id = NEW.item_id AND stall_id = NEW.stall_id
    FOR UPDATE;

    SELECT COALESCE(SUM(quantity_allocated), 0) INTO v_allocated
    FROM stock_distribution
    WHERE item_id = NEW.item_id AND stall_id = NEW.stall_id;

    SELECT COALESCE(SUM(quantity_sold), 0) INTO v_sold
    FROM sales
    WHERE item_id = NEW.item_id
      AND stall_id = NEW.stall_id
      AND (TG_OP = 'INSERT' OR sale_id <> NEW.sale_id);

    v_available := v_allocated - v_sold;
    IF v_available < NEW.quantity_sold THEN
      RAISE EXCEPTION 'Only % left at this stall. You asked to sell %.',
        GREATEST(v_available, 0), NEW.quantity_sold;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_sale_stock_trigger
  BEFORE INSERT OR UPDATE OF item_id, stall_id, quantity_sold ON sales
  FOR EACH ROW
  EXECUTE FUNCTION enforce_sale_stock();

CREATE OR REPLACE FUNCTION enforce_distribution_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
  v_needed INTEGER;
BEGIN
  IF NEW.quantity_allocated IS NULL OR NEW.quantity_allocated < 0 THEN
    RAISE EXCEPTION 'Distribution quantity cannot be negative.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.quantity_allocated <= 0 THEN
    RAISE EXCEPTION 'Distribution quantity must be greater than zero.';
  END IF;

  -- Shrinking a batch (a stall return) does not take from the hub.
  IF TG_OP = 'UPDATE' AND NEW.quantity_allocated <= OLD.quantity_allocated THEN
    RETURN NEW;
  END IF;

  PERFORM lock_item(NEW.item_id);
  v_available := compute_hub_stock(NEW.item_id);
  v_needed := CASE
    WHEN TG_OP = 'UPDATE' THEN NEW.quantity_allocated - OLD.quantity_allocated
    ELSE NEW.quantity_allocated
  END;

  IF v_available < v_needed THEN
    RAISE EXCEPTION 'Only % left at the central hub. You asked to send %.',
      v_available, v_needed;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_distribution_stock_trigger
  BEFORE INSERT OR UPDATE OF quantity_allocated, item_id ON stock_distribution
  FOR EACH ROW
  EXECUTE FUNCTION enforce_distribution_stock();

CREATE OR REPLACE FUNCTION enforce_hub_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
BEGIN
  -- Stall returns are checked inside withdraw_from_distribution_atomic,
  -- against the batch size *before* it is shrunk. By the time this row is
  -- inserted the batch has already been reduced, so we must not re-check it.
  IF NEW.stall_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM lock_item(NEW.item_id);
  v_available := compute_hub_stock(NEW.item_id);
  IF v_available < NEW.quantity_withdrawn THEN
    RAISE EXCEPTION 'Only % left at the central hub. You asked to withdraw %.',
      v_available, NEW.quantity_withdrawn;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_hub_withdrawal_trigger
  BEFORE INSERT ON stock_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION enforce_hub_withdrawal();

CREATE OR REPLACE FUNCTION recalc_hub_if_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
  ELSE
    v_item_id := NEW.item_id;
  END IF;

  -- Stall sales never change hub stock.
  IF TG_TABLE_NAME = 'sales' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.stall_id IS NOT NULL THEN RETURN OLD; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.stall_id IS NOT NULL AND OLD.stall_id IS NOT NULL THEN RETURN NEW; END IF;
    ELSE
      IF NEW.stall_id IS NOT NULL THEN RETURN NEW; END IF;
    END IF;
  END IF;

  PERFORM recalc_item_stock(v_item_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_after_hub_sale
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION recalc_hub_if_needed();

CREATE TRIGGER recalc_after_distribution
  AFTER INSERT OR UPDATE OR DELETE ON stock_distribution
  FOR EACH ROW
  EXECUTE FUNCTION recalc_hub_if_needed();

CREATE TRIGGER recalc_after_addition
  AFTER INSERT OR UPDATE OR DELETE ON stock_additions
  FOR EACH ROW
  EXECUTE FUNCTION recalc_hub_if_needed();

CREATE TRIGGER recalc_after_withdrawal
  AFTER INSERT OR UPDATE OR DELETE ON stock_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION recalc_hub_if_needed();

-- ----------------------------------------------------------------------------
-- Atomic RPCs. One round-trip, one transaction, one lock.
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
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity to add must be greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);

  INSERT INTO stock_additions (item_id, quantity_added, added_by)
  VALUES (p_item_id, p_quantity, p_added_by);

  SELECT * INTO v_item FROM items WHERE item_id = p_item_id;
  RETURN v_item;
END;
$$;

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
BEGIN
  IF p_stall_id IS NOT NULL OR p_distribution_id IS NOT NULL THEN
    RAISE EXCEPTION 'Returning stock from a stall must use withdraw_from_distribution_atomic so the batch and the audit row stay together.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Withdrawal quantity must be greater than zero.';
  END IF;

  PERFORM lock_item(p_item_id);

  INSERT INTO stock_withdrawals (item_id, quantity_withdrawn, reason, withdrawn_by, notes, stall_id, distribution_id)
  VALUES (
    p_item_id,
    p_quantity,
    COALESCE(p_reason, 'General withdrawal'),
    p_withdrawn_by,
    p_notes,
    NULL,
    NULL
  );

  SELECT * INTO v_item FROM items WHERE item_id = p_item_id;
  RETURN v_item;
END;
$$;

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
END;
$$;

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
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  -- Always lock the item first, then the batch. The sale trigger locks in
  -- that order; reversing it here would deadlock under concurrent use.
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

  IF p_quantity > v_batch.quantity_allocated THEN
    RAISE EXCEPTION 'Only % unit(s) left in this batch.', v_batch.quantity_allocated;
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

  SELECT COALESCE(SUM(quantity_allocated), 0) INTO v_available
  FROM stock_distribution
  WHERE item_id = p_item_id AND stall_id = p_stall_id;

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Only % left at this stall. You asked to withdraw %.',
      v_available, p_quantity;
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

CREATE OR REPLACE FUNCTION create_sale_atomic(
  p_item_id INTEGER,
  p_stall_id INTEGER,
  p_quantity_sold INTEGER,
  p_unit_price NUMERIC,
  p_total_amount NUMERIC,
  p_sale_type VARCHAR,
  p_recorded_by INTEGER,
  p_cash_amount NUMERIC DEFAULT NULL,
  p_mobile_amount NUMERIC DEFAULT NULL,
  p_customer_name VARCHAR DEFAULT NULL,
  p_customer_contact VARCHAR DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale sales;
  v_paid NUMERIC;
  v_status VARCHAR;
BEGIN
  IF p_quantity_sold IS NULL OR p_quantity_sold <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'Selling price must be zero or greater.';
  END IF;

  PERFORM lock_item(p_item_id);

  INSERT INTO sales (
    item_id, stall_id, quantity_sold, unit_price, total_amount,
    sale_type, cash_amount, mobile_amount, recorded_by
  ) VALUES (
    p_item_id, p_stall_id, p_quantity_sold, p_unit_price, p_total_amount,
    p_sale_type,
    CASE WHEN p_sale_type = 'split' THEN p_cash_amount ELSE NULL END,
    CASE WHEN p_sale_type = 'split' THEN p_mobile_amount ELSE NULL END,
    p_recorded_by
  )
  RETURNING * INTO v_sale;

  IF p_sale_type = 'credit' THEN
    v_paid := COALESCE(p_amount_paid, 0);
    IF v_paid < 0 THEN
      RAISE EXCEPTION 'Amount paid must be zero or greater.';
    END IF;
    IF v_paid > p_total_amount THEN
      RAISE EXCEPTION 'Amount paid cannot exceed the sale total.';
    END IF;
    v_status := CASE
      WHEN v_paid >= p_total_amount THEN 'fully_paid'
      WHEN v_paid > 0 THEN 'partially_paid'
      ELSE 'unpaid'
    END;

    INSERT INTO credit_sales (
      sale_id, customer_name, customer_contact,
      total_credit_amount, amount_paid, payment_status, due_date, notes
    ) VALUES (
      v_sale.sale_id,
      COALESCE(NULLIF(p_customer_name, ''), 'Customer'),
      COALESCE(NULLIF(p_customer_contact, ''), 'N/A'),
      p_total_amount, v_paid, v_status, p_due_date, p_notes
    );
  END IF;

  RETURN to_jsonb(v_sale);
END;
$$;

GRANT EXECUTE ON FUNCTION compute_hub_stock(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_central_stock_replay(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION stall_remaining(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION lock_item(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION recalc_item_stock(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_stock_atomic(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_stock_atomic(INTEGER, INTEGER, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION distribute_stock_atomic_v2(INTEGER, JSONB, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_distribution_atomic(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_stall_atomic(INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sale_atomic(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, VARCHAR, INTEGER, NUMERIC, NUMERIC, VARCHAR, VARCHAR, NUMERIC, DATE, TEXT) TO anon, authenticated;

-- Re-sync stored hub figures from the corrected ledger.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT item_id FROM items LOOP
    PERFORM recalc_item_stock(r.item_id);
  END LOOP;
END $$;
