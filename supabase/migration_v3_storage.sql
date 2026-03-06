-- ============================================
-- POS Warung — V3 Migration: Supabase Storage
-- Run this AFTER migration_v2.sql
-- ============================================

-- 1. Create storage bucket for product images
-- NOTE: Run this via Supabase Dashboard → Storage → Create Bucket
-- Bucket name: product-images
-- Public: Yes (so images can be displayed without auth)
-- File size limit: 2MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- 2. Storage Policies (run in SQL Editor)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR
INSERT
    TO authenticated
WITH
    CHECK (bucket_id = 'product-images');

-- Allow anyone to view (public bucket)
CREATE POLICY "Anyone can view product images" ON storage.objects FOR
SELECT TO public USING (bucket_id = 'product-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update product images" ON storage.objects FOR
UPDATE TO authenticated USING (bucket_id = 'product-images');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');