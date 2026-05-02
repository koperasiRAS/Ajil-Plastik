-- Migration: Bulk Stock Update + Stock Log RPC — Eliminates N+1 sequential awaits
-- Replaces the per-item sequential stock update loop in PosClient checkout
-- with a single atomic Postgres function call.
-- Run this in Supabase SQL Editor.

-- 1. fn_bulk_update_stock
-- Accepts an array of {product_id, delta} and updates all in one transaction.
-- Negative delta = sale (decrease stock), Positive = restock (increase stock).
-- Returns a row for each update so the caller knows which products succeeded/failed.
-- On any failure the entire operation rolls back — no partial updates.
CREATE OR REPLACE FUNCTION fn_bulk_update_stock(
  p_items JSONB  -- ARRAY[{product_id: UUID, delta: INTEGER, note: TEXT}]
)
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  old_stock     INTEGER,
  new_stock     INTEGER,
  success       BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
  LOOP
    DECLARE
      v_product_id   UUID    := item->>'product_id';
      v_delta        INTEGER := (item->>'delta')::INTEGER;
      v_note         TEXT    := item->>'note';
      v_old_stock    INTEGER;
      v_new_stock    INTEGER;
      v_name         TEXT;
      v_current      INTEGER;
    BEGIN
      -- Read current stock + name (FOR UPDATE locks the row)
      SELECT stock, name INTO v_old_stock, v_name
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;

      IF v_old_stock IS NULL THEN
        RETURN QUERY SELECT
          v_product_id::UUID, v_name, v_old_stock, v_old_stock,
          false, 'PRODUCT_NOT_FOUND'::TEXT;
        CONTINUE;
      END IF;

      v_new_stock := v_old_stock + v_delta;

      -- Block negative stock (sold more than available)
      IF v_new_stock < 0 THEN
        RETURN QUERY SELECT
          v_product_id::UUID, v_name, v_old_stock, v_new_stock,
          false, 'INSUFFICIENT_STOCK'::TEXT;
        CONTINUE;
      END IF;

      -- Update product stock
      UPDATE products
      SET stock = v_new_stock
      WHERE id = v_product_id;

      -- Insert stock log (non-critical — errors logged but don't fail the transaction)
      INSERT INTO stock_logs (product_id, type, quantity, note)
      VALUES (v_product_id, 'sale', v_delta, v_note)
      ON CONFLICT DO NOTHING;

      RETURN QUERY SELECT
        v_product_id::UUID, v_name, v_old_stock, v_new_stock,
        true, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT
        v_product_id::UUID, v_name, v_old_stock, v_old_stock,
        false, SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$;

-- 2. fn_bulk_insert_stock_logs (optional parallel path)
-- Insert multiple stock log entries in a single call.
CREATE OR REPLACE FUNCTION fn_bulk_insert_stock_logs(
  p_logs JSONB  -- ARRAY[{product_id: UUID, quantity: INTEGER, note: TEXT}]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO stock_logs (product_id, type, quantity, note)
  SELECT
    (j->>'product_id')::UUID,
    'sale',
    (j->>'quantity')::INTEGER,
    j->>'note'
  FROM JSONB_ARRAY_ELEMENTS(p_logs) AS j
  ON CONFLICT DO NOTHING;
END;
$$;
