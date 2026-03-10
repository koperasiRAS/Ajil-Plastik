-- Migration v7: Update Categories for Toko Plastik
-- Replaces old categories with plastic store categories

-- Delete existing categories
DELETE FROM categories WHERE name IN ('Sembako', 'Minuman', 'Makanan Ringan', 'Rokok', 'Peralatan Rumah', 'Lainnya');

-- Insert new categories for Toko Plastik
INSERT INTO categories (name) VALUES
    ('Kantong Plastik'),
    ('Box Plastik'),
    ('Kemasan Food Grade'),
    ('Pupuk & Chemical'),
    ('Aksesoris Kemasan'),
    ('Plastik Rol'),
    ('Lainnya')
ON CONFLICT (name) DO NOTHING;
