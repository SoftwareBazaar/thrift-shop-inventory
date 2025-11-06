-- Thrift Shop Multi-Stall Inventory Management System Database Schema
-- Safe version that handles existing objects gracefully

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
    stall_id INTEGER,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stalls table
CREATE TABLE IF NOT EXISTS stalls (
    stall_id SERIAL PRIMARY KEY,
    stall_name VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    initial_stock INTEGER NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sku VARCHAR(50) UNIQUE,
    created_by INTEGER REFERENCES users(user_id) NOT NULL
);

-- Stock additions table
CREATE TABLE IF NOT EXISTS stock_additions (
    addition_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    quantity_added INTEGER NOT NULL,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(user_id) NOT NULL
);

-- Stock distribution table
CREATE TABLE IF NOT EXISTS stock_distribution (
    distribution_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    stall_id INTEGER REFERENCES stalls(stall_id) ON DELETE CASCADE,
    quantity_allocated INTEGER NOT NULL,
    date_distributed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    distributed_by INTEGER REFERENCES users(user_id) NOT NULL
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    sale_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    stall_id INTEGER REFERENCES stalls(stall_id) ON DELETE CASCADE,
    quantity_sold INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('cash', 'credit', 'mobile', 'split')),
    cash_amount DECIMAL(10,2) DEFAULT NULL,
    mobile_amount DECIMAL(10,2) DEFAULT NULL,
    date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_by INTEGER REFERENCES users(user_id) NOT NULL
);

-- Credit sales table
CREATE TABLE IF NOT EXISTS credit_sales (
    credit_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(sale_id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_contact VARCHAR(50) NOT NULL,
    total_credit_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2) GENERATED ALWAYS AS (total_credit_amount - amount_paid) STORED,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'fully_paid')),
    due_date DATE,
    notes TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log table for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date_time);
CREATE INDEX IF NOT EXISTS idx_sales_stall ON sales(stall_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_status ON credit_sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password_hash, full_name, role, status) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin', 'active')
ON CONFLICT (username) DO NOTHING;

-- Create a function to update current_stock when sales are made
CREATE OR REPLACE FUNCTION update_current_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the current_stock in items table
    UPDATE items 
    SET current_stock = current_stock - NEW.quantity_sold 
    WHERE item_id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS trigger_update_current_stock ON sales;
CREATE TRIGGER trigger_update_current_stock
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_current_stock();

-- Create a function to log activities
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        COALESCE(NEW.created_by, NEW.recorded_by, NEW.added_by, NEW.distributed_by),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.item_id, NEW.sale_id, NEW.user_id, NEW.stall_id),
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist, then create them
DROP TRIGGER IF EXISTS trigger_log_items_activity ON items;
CREATE TRIGGER trigger_log_items_activity
    AFTER INSERT OR UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS trigger_log_sales_activity ON sales;
CREATE TRIGGER trigger_log_sales_activity
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS trigger_log_users_activity ON users;
CREATE TRIGGER trigger_log_users_activity
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

