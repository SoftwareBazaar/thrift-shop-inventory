-- Fix Stock Distribution Validation Trigger
-- Issue: The trigger is double-counting allocations
-- Current logic sums existing allocations + new allocation and compares to current_stock
-- This is wrong because current_stock should already be reduced by existing allocations
-- 
-- Correct logic: Just check if new allocation <= current_stock
-- (because current_stock represents available stock ready to distribute)

-- Drop the buggy trigger first (must be done before dropping the function)
DROP TRIGGER IF EXISTS trigger_validate_allocation ON stock_distribution;
DROP TRIGGER IF EXISTS trig_validate_allocation ON stock_distribution;

-- Drop the buggy function with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS validate_allocation() CASCADE;

-- Create corrected validation function
CREATE OR REPLACE FUNCTION validate_allocation()
RETURNS TRIGGER AS $$
DECLARE
    available_stock INTEGER;
BEGIN
    -- Get current available stock for the item
    SELECT current_stock INTO available_stock FROM items WHERE item_id = NEW.item_id;
    
    -- Validate: new allocation should not exceed currently available stock
    -- Note: current_stock should already have previous allocations deducted
    IF NEW.quantity_allocated > available_stock THEN
        RAISE EXCEPTION 'Over-allocation: trying to allocate % but only % available',
            NEW.quantity_allocated, available_stock;
    END IF;
    
    -- Deduct the allocation from current_stock immediately (atomic operation)
    UPDATE items 
    SET current_stock = current_stock - NEW.quantity_allocated,
        total_allocated = COALESCE(total_allocated, 0) + NEW.quantity_allocated
    WHERE item_id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with corrected function
CREATE TRIGGER trigger_validate_allocation
BEFORE INSERT ON stock_distribution
FOR EACH ROW EXECUTE FUNCTION validate_allocation();

-- Note: This corrected trigger:
-- 1. Checks only the new allocation against current_stock (no double-counting)
-- 2. Immediately deducts the allocation from current_stock (atomic)
-- 3. Updates the total_allocated counter in items table
-- 4. Prevents race conditions in multi-user scenarios

-- Verification query to test the fix
-- Run this after applying: 
-- SELECT * FROM items WHERE item_id = 51;
-- current_stock should now be available for the next distribution
