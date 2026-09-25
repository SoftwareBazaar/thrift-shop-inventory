-- Fix: add_stock_atomic / stock_additions inserts were failing with
--   record "old" has no field "stall_id"
--
-- recalc_hub_if_needed is shared across sales, stock_additions,
-- stock_distribution, and stock_withdrawals. A compound AND that mentioned
-- OLD.stall_id could be evaluated even when the firing table has no stall_id
-- (Postgres does not guarantee boolean short-circuit for record field access).
-- Nested IF + jsonb field reads keep stall_id logic sales-only.

CREATE OR REPLACE FUNCTION recalc_hub_if_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id INTEGER;
  v_old_item_id INTEGER;
  v_old_stall TEXT;
  v_new_stall TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
  ELSE
    v_item_id := NEW.item_id;
  END IF;

  -- Pure stall sales never change hub stock. Only the sales table has the
  -- meaning of stall_id we care about here — read via jsonb so this function
  -- never crashes on stock_additions / distribution / withdrawals.
  IF TG_TABLE_NAME = 'sales' THEN
    IF TG_OP = 'DELETE' THEN
      v_old_stall := to_jsonb(OLD)->>'stall_id';
      IF v_old_stall IS NOT NULL THEN
        RETURN OLD;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      v_old_stall := to_jsonb(OLD)->>'stall_id';
      v_new_stall := to_jsonb(NEW)->>'stall_id';
      IF v_new_stall IS NOT NULL AND v_old_stall IS NOT NULL THEN
        RETURN NEW;
      END IF;
    ELSE
      -- INSERT
      v_new_stall := to_jsonb(NEW)->>'stall_id';
      IF v_new_stall IS NOT NULL THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  PERFORM recalc_item_stock(v_item_id);

  -- Hub sale moved to a different item: restore the previous item's stock too.
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'sales' THEN
      v_old_item_id := OLD.item_id;
      IF v_old_item_id IS DISTINCT FROM NEW.item_id THEN
        v_old_stall := to_jsonb(OLD)->>'stall_id';
        v_new_stall := to_jsonb(NEW)->>'stall_id';
        IF v_old_stall IS NULL OR v_new_stall IS NULL THEN
          PERFORM recalc_item_stock(v_old_item_id);
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
