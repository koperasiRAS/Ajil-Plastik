-- ============================================
-- POS Warung Sembako — Enhancement Migration
-- Run this AFTER the initial migration.sql
-- ============================================

-- 1. Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id),
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add category to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories (id);

-- 4. Add payment_method and discount to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (
    payment_method IN ('cash', 'qris', 'transfer')
);

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS discount NUMERIC(12, 2) DEFAULT 0;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses (user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

-- 6. RLS for new tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read categories" ON categories FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Owner can manage categories" ON categories FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

CREATE POLICY "Owner can manage expenses" ON expenses FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

CREATE POLICY "Owner can read all expenses" ON expenses FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- 7. Insert default categories
INSERT INTO
    categories (name)
VALUES ('Sembako'),
    ('Minuman'),
    ('Makanan Ringan'),
    ('Rokok'),
    ('Peralatan Rumah'),
    ('Lainnya') ON CONFLICT (name) DO NOTHING;