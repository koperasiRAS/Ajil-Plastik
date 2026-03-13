-- ===============================================
-- DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
-- Run this SQL in your Supabase SQL Editor
-- ===============================================

-- ===============================================
-- TRANSACTIONS TABLE INDEXES
-- ===============================================

-- Index for date range queries (dashboard, reports, history)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
ON transactions(created_at DESC);

-- Index for user-specific transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id
ON transactions(user_id);

-- Index for payment method filtering
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method
ON transactions(payment_method);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
ON transactions(user_id, created_at DESC);

-- ===============================================
-- TRANSACTION ITEMS TABLE INDEXES
-- ===============================================

-- Index for transaction items lookup
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
ON transaction_items(transaction_id);

-- Index for product sales analysis
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id
ON transaction_items(product_id);

-- Note: transaction_items uses transactions.created_at via join for date logic

-- ===============================================
-- PRODUCTS TABLE INDEXES
-- ===============================================

-- Index for barcode lookup (POS scanning)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
ON products(barcode);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category_id
ON products(category_id);

-- Index for stock alerts (low stock)
CREATE INDEX IF NOT EXISTS idx_products_stock
ON products(stock);

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_products_name
ON products(name);

-- ===============================================
-- STOCK LOGS TABLE INDEXES
-- ===============================================

-- Index for product stock history
CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id
ON stock_logs(product_id, created_at DESC);

-- Index for stock type filtering
CREATE INDEX IF NOT EXISTS idx_stock_logs_type
ON stock_logs(type);

-- ===============================================
-- EXPENSES TABLE INDEXES
-- ===============================================

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_expenses_date
ON expenses(date DESC);

-- Index for user-specific expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_id
ON expenses(user_id);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_expenses_category
ON expenses(category);

-- ===============================================
-- SHIFTS TABLE INDEXES
-- ===============================================

-- Index for open shift lookup
CREATE INDEX IF NOT EXISTS idx_shifts_user_status
ON shifts(user_id, status);

-- Index for shift date queries
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at
ON shifts(opened_at DESC);

-- ===============================================
-- CATEGORIES TABLE INDEXES
-- ===============================================

-- Index for category name lookup
CREATE INDEX IF NOT EXISTS idx_categories_name
ON categories(name);

-- ===============================================
-- VERIFY INDEXES
-- ===============================================

-- List all indexes in current database
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
