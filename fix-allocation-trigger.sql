-- Fix the allocation validation trigger
-- Current bug: Trigger checks total_allocated against current_stock
-- This is wrong because current_stock already has previous allocations deducted

-- The trigger should check: new_allocation <= current_stock (available now)
-- NOT: (total_allocated + new_allocation) <= current_stock

-- Drop the buggy trigger
DROP TRIGGER IF EXISTS trigger_validate_allocation ON stock_distribution;

-- Create corrected validation function
CREATE OR REPLACE FUNCTION validate_allocation()
RETURNS TRIGGER AS $$
DECLARE
    available_stock INTEGER;
BEGIN
    -- Get current available stock for the item
    SELECT current_stock INTO available_stock FROM items WHERE item_id = NEW.item_id;
    
    -- Check if new allocation exceeds currently available stock
    -- We don't need to sum existing allocations because they're already deducted from current_stock
    IF NEW.quantity_allocated > available_stock THEN
        RAISE EXCEPTION 'Over-allocation: trying to allocate % but only % available',
            NEW.quantity_allocated, available_stock;
    END IF;
    
    -- Update current_stock immediately (deduct the allocation)
    UPDATE items 
    SET current_stock = current_stock - NEW.quantity_allocated
    WHERE item_id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with corrected function
CREATE TRIGGER trigger_validate_allocation
BEFORE INSERT OR UPDATE ON stock_distribution
FOR EACH ROW EXECUTE FUNCTION validate_allocation();

-- Note: This fix ensures that:
-- 1. Each allocation is checked against current available stock only
-- 2. Stock is deducted immediately in the trigger (atomic operation)
-- 3. Multiple distributions in a batch will work correctly
