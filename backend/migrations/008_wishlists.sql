-- Migration 008: Customer wishlist / saved products
-- Run once: psql -d amazing_toys_sos -f migrations/008_wishlists.sql

CREATE TABLE IF NOT EXISTS wishlists (
  wishlist_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID         NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  product_id   VARCHAR(20)  NOT NULL REFERENCES products(product_id)   ON DELETE CASCADE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_customer ON wishlists (customer_id);
