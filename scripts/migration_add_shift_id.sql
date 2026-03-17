-- Migration: Add shift_id to transactions table
-- Run this in Supabase SQL Editor

-- 1. Add shift_id column to transactions table
ALTER TABLE transactions
ADD COLUMN shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

-- 2. Create index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id ON transactions(shift_id);

-- 3. Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'shift_id';
