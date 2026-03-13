-- ===============================================
-- ADD is_active COLUMN TO PRODUCTS TABLE
-- Run this in Supabase SQL Editor
-- ===============================================

-- Add is_active column (default TRUE so existing products remain visible)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update any NULL values to true (safety)
UPDATE products SET is_active = true WHERE is_active IS NULL;

-- Index for filtering active/inactive products
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
