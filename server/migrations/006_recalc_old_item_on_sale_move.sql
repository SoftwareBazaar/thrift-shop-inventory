-- When a hub sale's item_id changes, recompute BOTH items.
-- Previously only NEW.item_id was recalculated, leaving the old item's
-- current_stock permanently low.

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

  -- Stall sales never change hub stock (unless moving on/off the hub).
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

  -- item_id change on a hub-affecting sale: restore the previous item too.
  IF TG_OP = 'UPDATE'
     AND TG_TABLE_NAME = 'sales'
     AND OLD.item_id IS DISTINCT FROM NEW.item_id
     AND (OLD.stall_id IS NULL OR NEW.stall_id IS NULL)
  THEN
    PERFORM recalc_item_stock(OLD.item_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
