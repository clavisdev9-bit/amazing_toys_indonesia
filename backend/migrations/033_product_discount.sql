-- CR: Per-product discount percentage (Opsi A)
-- Adds an optional discount_percent column to products.
-- NULL = no discount. Valid range: 0 (inclusive) to 100 (exclusive).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT NULL
    CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent < 100));

COMMENT ON COLUMN products.discount_percent
  IS 'Optional sale discount in %. NULL = no discount. Applied automatically at checkout; unit_price stored as effective price.';
