-- Migration v5: Database Indexes for Performance
-- Uses IF NOT EXISTS to safely re-run without errors

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON stock_logs (product_id);

CREATE INDEX IF NOT EXISTS idx_stock_logs_created_at ON stock_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);

CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts (user_id);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);