-- Migration 007: Set sample stock to 20 pcs for all products, and add base product categories table.

-- ─── 1. Update semua stok produk ke 20 pcs ────────────────────────────────
-- Trigger trg_products_stock_status akan otomatis mengubah stock_status → AVAILABLE.
UPDATE products
SET stock_quantity = 20
WHERE is_active = TRUE;

-- ─── 2. Tabel kategori dasar produk ───────────────────────────────────────
-- Menyimpan kategori yang selalu tersedia sebagai pilihan, terlepas dari
-- apakah ada produk yang menggunakan kategori tersebut.
CREATE TABLE IF NOT EXISTS product_categories (
    category_id SERIAL      PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Isi kategori dasar ────────────────────────────────────────────────
INSERT INTO product_categories (name) VALUES
  ('Hobby''s'),
  ('Toys'),
  ('Art Toys'),
  ('Doll'),
  ('Anime')
ON CONFLICT (name) DO NOTHING;
