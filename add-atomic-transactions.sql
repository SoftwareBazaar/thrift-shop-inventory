-- Add buying_price column to items table if it doesn't exist
ALTER TABLE items ADD COLUMN IF NOT EXISTS buying_price DECIMAL(10,2) DEFAULT 0;

-- Create atomic transaction function for sales
CREATE OR REPLACE FUNCTION create_sale_atomic(
    p_item_id INTEGER,
    p_quantity_sold INTEGER,
    p_unit_price DECIMAL,
    p_total_amount DECIMAL,
    p_stall_id INTEGER,
    p_sale_type VARCHAR,
    p_recorded_by INTEGER,
    p_customer_name VARCHAR DEFAULT NULL,
    p_customer_contact VARCHAR DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_is_credit BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    sale_id INTEGER,
    item_id INTEGER,
    quantity_sold INTEGER,
    unit_price DECIMAL,
    total_amount DECIMAL,
    stall_id INTEGER,
    sale_type VARCHAR,
    date_time TIMESTAMP,
    recorded_by INTEGER
) AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_sale_id INTEGER;
    v_credit_id INTEGER;
BEGIN
    -- Start transaction (implicit in function)
    
    -- Lock the item row to prevent concurrent modifications
    SELECT current_stock INTO v_current_stock 
    FROM items 
    WHERE item_id = p_item_id 
    FOR UPDATE;
    
    -- Check if item exists
    IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;
    
    -- Check if sufficient stock available
    IF v_current_stock < p_quantity_sold THEN
        RAISE EXCEPTION 'insufficient stock available';
    END IF;
    
    -- Insert sale record
    INSERT INTO sales (
        item_id, stall_id, quantity_sold, unit_price, 
        total_amount, sale_type, recorded_by, date_time
    ) VALUES (
        p_item_id, p_stall_id, p_quantity_sold, p_unit_price,
        p_total_amount, p_sale_type, p_recorded_by, CURRENT_TIMESTAMP
    )
    RETURNING sales.sale_id INTO v_new_sale_id;
    
    -- If credit sale, insert credit record
    IF p_is_credit THEN
        INSERT INTO credit_sales (
            sale_id, customer_name, customer_contact,
            total_credit_amount, due_date, notes, payment_status
        ) VALUES (
            v_new_sale_id, p_customer_name, p_customer_contact,
            p_total_amount, p_due_date, p_notes, 'unpaid'
        )
        RETURNING credit_id INTO v_credit_id;
    END IF;
    
    -- Update current stock (this will also trigger the trigger)
    UPDATE items 
    SET current_stock = current_stock - p_quantity_sold
    WHERE item_id = p_item_id;
    
    -- Return the created sale
    RETURN QUERY
    SELECT 
        v_new_sale_id,
        p_item_id,
        p_quantity_sold,
        p_unit_price,
        p_total_amount,
        p_stall_id,
        p_sale_type,
        CURRENT_TIMESTAMP,
        p_recorded_by;
        
EXCEPTION WHEN OTHERS THEN
    -- Rollback happens automatically on exception
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create atomic transaction function for distribution
CREATE OR REPLACE FUNCTION distribute_stock_atomic(
    p_item_id INTEGER,
    p_stall_id INTEGER,
    p_quantity_allocated INTEGER,
    p_distributed_by INTEGER
)
RETURNS TABLE (
    distribution_id INTEGER,
    item_id INTEGER,
    stall_id INTEGER,
    quantity_allocated INTEGER,
    date_distributed TIMESTAMP,
    distributed_by INTEGER
) AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_dist_id INTEGER;
BEGIN
    -- Lock the item row
    SELECT current_stock INTO v_current_stock 
    FROM items 
    WHERE item_id = p_item_id 
    FOR UPDATE;
    
    -- Check if item exists
    IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;
    
    -- Check if sufficient stock available
    IF v_current_stock < p_quantity_allocated THEN
        RAISE EXCEPTION 'insufficient stock available';
    END IF;
    
    -- Check if stall exists and is active
    IF NOT EXISTS (SELECT 1 FROM stalls WHERE stall_id = p_stall_id AND status = 'active') THEN
        RAISE EXCEPTION 'Stall not found or inactive';
    END IF;
    
    -- Insert distribution record
    INSERT INTO stock_distribution (
        item_id, stall_id, quantity_allocated, 
        distributed_by, date_distributed
    ) VALUES (
        p_item_id, p_stall_id, p_quantity_allocated,
        p_distributed_by, CURRENT_TIMESTAMP
    )
    RETURNING stock_distribution.distribution_id INTO v_new_dist_id;
    
    -- Update current stock
    UPDATE items 
    SET current_stock = current_stock - p_quantity_allocated
    WHERE item_id = p_item_id;
    
    -- Return the created distribution
    RETURN QUERY
    SELECT 
        v_new_dist_id,
        p_item_id,
        p_stall_id,
        p_quantity_allocated,
        CURRENT_TIMESTAMP,
        p_distributed_by;
        
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Disable the trigger to prevent double-decrement since we're handling it in the function
DROP TRIGGER IF EXISTS trigger_update_current_stock ON sales;

-- Create index on buying_price for profit calculations
CREATE INDEX IF NOT EXISTS idx_items_buying_price ON items(buying_price);
