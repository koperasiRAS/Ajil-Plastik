-- =====================================================
-- RLS POLICIES FOR AJIL PLASTIK POS
-- Row Level Security untuk multi-store isolation
-- =====================================================
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Enable RLS on all tables
-- =====================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- 2. Products policies
-- =====================================================
-- User hanya bisa lihat produk dari store mereka
CREATE POLICY "Products select by store"
ON products FOR SELECT
USING (
  store_id IS NULL OR
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid())
);

-- User hanya bisa insert produk untuk store mereka
CREATE POLICY "Products insert by store"
ON products FOR INSERT
WITH CHECK (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- User hanya bisa update produk dari store mereka
CREATE POLICY "Products update by store"
ON products FOR UPDATE
USING (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- User hanya bisa delete produk dari store mereka
CREATE POLICY "Products delete by store"
ON products FOR DELETE
USING (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- 3. Transactions policies
-- =====================================================
-- User hanya bisa lihat transaksi dari store mereka
CREATE POLICY "Transactions select by store"
ON transactions FOR SELECT
USING (
  store_id IS NULL OR
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid())
);

-- User hanya bisa insert transaksi untuk store mereka
CREATE POLICY "Transactions insert by store"
ON transactions FOR INSERT
WITH CHECK (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- 4. Expenses policies
-- =====================================================
-- User hanya bisa lihat expenses dari store mereka
CREATE POLICY "Expenses select by store"
ON expenses FOR SELECT
USING (
  store_id IS NULL OR
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid())
);

-- User hanya bisa insert expenses untuk store mereka
CREATE POLICY "Expenses insert by store"
ON expenses FOR INSERT
WITH CHECK (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- User hanya bisa update expenses dari store mereka
CREATE POLICY "Expenses update by store"
ON expenses FOR UPDATE
USING (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- User hanya bisa delete expenses dari store mereka
CREATE POLICY "Expenses delete by store"
ON expenses FOR DELETE
USING (
  store_id IN (SELECT store_id FROM users WHERE id = auth.uid()) OR
  store_id IS NULL
);

-- 5. Shifts policies
-- =====================================================
-- User hanya bisa lihat shift mereka sendiri
CREATE POLICY "Shifts select by user"
ON shifts FOR SELECT
USING (
  user_id = auth.uid() OR
  user_id IN (SELECT id FROM users WHERE id = auth.uid())
);

-- User hanya bisa buat shift untuk diri sendiri
CREATE POLICY "Shifts insert by user"
ON shifts FOR INSERT
WITH CHECK (user_id = auth.uid());

-- User hanya bisa update shift mereka sendiri
CREATE POLICY "Shifts update by user"
ON shifts FOR UPDATE
USING (user_id = auth.uid());

-- 6. Verify RLS is enabled
-- =====================================================
SELECT
  'products' as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'products'
UNION ALL
SELECT
  'transactions',
  relrowsecurity
FROM pg_class
WHERE relname = 'transactions'
UNION ALL
SELECT
  'expenses',
  relrowsecurity
FROM pg_class
WHERE relname = 'expenses'
UNION ALL
SELECT
  'shifts',
  relrowsecurity
FROM pg_class
WHERE relname = 'shifts';

-- 7. List all policies
-- =====================================================
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
