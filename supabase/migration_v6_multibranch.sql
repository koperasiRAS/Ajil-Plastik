-- Migration v6: Multi-Branch Support (Stores/Cabang)
-- Adds store/branch management to support multiple outlets

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default stores (2 branches)
INSERT INTO stores (name, address, phone, is_active) VALUES
    ('Ajil Plastik Pusat', 'Jl. Boulevard Gran City, Jatimulya, Kec. Ci, Kota Depok, Jawa', '628551218', true),
    ('Ajil Plastik Cab. 2', 'Jl. Sudirman No. 456, Kota Bandung', '081234567891', true)
ON CONFLICT DO NOTHING;

-- Add store_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- Create store_products table for per-branch inventory
CREATE TABLE IF NOT EXISTS store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(store_id, product_id)
);

-- Enable RLS on stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores
DROP POLICY IF EXISTS "Allow all access to stores" ON stores;
CREATE POLICY "Allow all access to stores" ON stores FOR ALL USING (true);

-- Enable RLS on store_products
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_products
DROP POLICY IF EXISTS "Allow all access to store_products" ON store_products;
CREATE POLICY "Allow all access to store_products" ON store_products FOR ALL USING (true);

-- Create indexes for stores and store_products
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_store_products_store_id ON store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_store_products_product_id ON store_products(product_id);
