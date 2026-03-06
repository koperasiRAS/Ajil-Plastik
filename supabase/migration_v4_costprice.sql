-- ============================================
-- POS Warung — V4 Migration: Cost Price (Harga Modal)
-- Run this AFTER migration_v2.sql
-- ============================================

-- Add cost_price (harga modal) to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- Add cost_price to transaction_items (untuk kalkulasi profit per transaksi)
ALTER TABLE transaction_items
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;