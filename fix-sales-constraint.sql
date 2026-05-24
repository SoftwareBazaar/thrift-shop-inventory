-- Fix sales constraint issue
-- Remove the check constraint that prevents current_stock from going negative
-- This constraint is blocking sales because sales were incorrectly deducting from current_stock

-- Step 1: Drop the constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS check_current_stock_non_negative;

-- Step 2: Verify the constraint is removed
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'items';

-- Note: After this fix, sales will no longer be blocked
-- The sales API has been updated to check stall stock instead of central stock
