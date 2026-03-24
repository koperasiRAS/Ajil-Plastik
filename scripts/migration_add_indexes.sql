-- =====================================================
-- DATABASE INDEXES FOR AJIL PLASTIK POS
-- Optimasi performa query
-- =====================================================
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================

-- Transactions table indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_shift_id
ON transactions(shift_id);

CREATE INDEX IF NOT EXISTS idx_transactions_store_id
ON transactions(store_id);

CREATE INDEX IF NOT EXISTS idx_transactions_payment
ON transactions(payment_method);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
ON transactions(user_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_store_date
ON transactions(store_id, created_at DESC);

-- Transaction Items table indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
ON transaction_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id
ON transaction_items(product_id);

-- Expenses table indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_expenses_created_at
ON expenses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_store_id
ON expenses(store_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category
ON expenses(category);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_expenses_store_date
ON expenses(store_id, created_at DESC);

-- Products table indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_store_id
ON products(store_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id
ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_stock
ON products(stock);

CREATE INDEX IF NOT EXISTS idx_products_name
ON products(name);

-- Composite index for POS queries
CREATE INDEX IF NOT EXISTS idx_products_store_active
ON products(store_id, is_active)
WHERE is_active = true OR is_active IS NULL;

-- Shifts table indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_shifts_status
ON shifts(status);

CREATE INDEX IF NOT EXISTS idx_shifts_user_id
ON shifts(user_id);

CREATE INDEX IF NOT EXISTS idx_shifts_store_id
ON shifts(store_id);

CREATE INDEX IF NOT EXISTS idx_shifts_opened_at
ON shifts(opened_at DESC);

-- Composite index for active shift lookup
CREATE INDEX IF NOT EXISTS idx_shifts_user_status
ON shifts(user_id, status);

-- Categories table indexes (if needed)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_categories_name
ON categories(name);

-- Verify all indexes created
-- =====================================================
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
