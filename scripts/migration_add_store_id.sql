-- Migration: Add store_id to support multi-branch/cabang
-- Run this in Supabase SQL Editor

-- 1. Add store_id to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 2. Add store_id to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 3. Add store_id to expenses table
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 4. Add store_id to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 5. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_store_id ON shifts(store_id);

-- 6. Verify columns were added
SELECT
  'products' as table_name,
  column_name
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'store_id'
UNION ALL
SELECT
  'transactions',
  column_name
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'store_id'
UNION ALL
SELECT
  'expenses',
  column_name
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'store_id'
UNION ALL
SELECT
  'shifts',
  column_name
FROM information_schema.columns
WHERE table_name = 'shifts' AND column_name = 'store_id';
