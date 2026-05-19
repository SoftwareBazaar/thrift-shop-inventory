-- Create stock_withdrawals table to track non-sale stock reductions
CREATE TABLE IF NOT EXISTS stock_withdrawals (
    withdrawal_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    quantity_withdrawn INTEGER NOT NULL,
    reason TEXT,
    date_withdrawn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_by INTEGER REFERENCES users(user_id) NOT NULL,
    notes TEXT
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_item ON stock_withdrawals(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_date ON stock_withdrawals(date_withdrawn);

-- Add comment to explain the table
COMMENT ON TABLE stock_withdrawals IS 'Tracks stock reductions for non-sale reasons (e.g., damange, personal use, owner withdrawal)';
