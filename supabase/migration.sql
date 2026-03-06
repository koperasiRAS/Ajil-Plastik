-- ============================================
-- POS Warung Sembako — Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'employee')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name TEXT NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Transaction items
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    transaction_id UUID REFERENCES transactions (id) ON DELETE CASCADE,
    product_id UUID REFERENCES products (id),
    quantity INTEGER NOT NULL,
    price NUMERIC(12, 2) NOT NULL
);

-- 5. Shifts table
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id),
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closing_cash NUMERIC(12, 2),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- 6. Stock logs
CREATE TABLE IF NOT EXISTS stock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    product_id UUID REFERENCES products (id),
    type TEXT NOT NULL CHECK (
        type IN (
            'restock',
            'sale',
            'adjustment'
        )
    ),
    quantity INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts (user_id);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);

CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON stock_logs (product_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;

-- Users: can read own row
CREATE POLICY "Users can read own data" ON users FOR
SELECT USING (auth.uid () = id);

-- Products: all authenticated can read, owner can insert/update/delete
CREATE POLICY "Authenticated can read products" ON products FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Owner can manage products" ON products FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

-- Transactions: authenticated can insert and read own
CREATE POLICY "Users can insert transactions" ON transactions FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can read own transactions" ON transactions FOR
SELECT USING (
        auth.uid () = user_id
        OR EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- Transaction items: follow transaction access
CREATE POLICY "Users can insert transaction items" ON transaction_items FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM transactions
            WHERE
                id = transaction_id
                AND user_id = auth.uid ()
        )
    );

CREATE POLICY "Users can read transaction items" ON transaction_items FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM transactions t
            WHERE
                t.id = transaction_id
                AND (
                    t.user_id = auth.uid ()
                    OR EXISTS (
                        SELECT 1
                        FROM users
                        WHERE
                            id = auth.uid ()
                            AND role = 'owner'
                    )
                )
        )
    );

-- Shifts: users manage own shifts, owner can see all
CREATE POLICY "Users can manage own shifts" ON shifts FOR ALL USING (auth.uid () = user_id);

CREATE POLICY "Owner can read all shifts" ON shifts FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- Stock logs: authenticated can insert, owner can read all
CREATE POLICY "Authenticated can insert stock logs" ON stock_logs FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Authenticated can read stock logs" ON stock_logs FOR
SELECT USING (
        auth.role () = 'authenticated'
    );