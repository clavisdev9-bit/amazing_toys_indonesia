-- =============================================================================
-- Migration 026: BUG-057 — Fix item_delete_requests.product_id type
-- products.product_id is VARCHAR(20), but item_delete_requests.product_id
-- was defined as INTEGER — causing 500 on every delete-request insert.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name  = 'item_delete_requests'
      AND column_name = 'product_id'
      AND data_type   = 'integer'
  ) THEN
    ALTER TABLE item_delete_requests
      ALTER COLUMN product_id TYPE VARCHAR(20) USING product_id::text;
    RAISE NOTICE 'item_delete_requests.product_id migrated INTEGER → VARCHAR(20)';
  ELSE
    RAISE NOTICE 'item_delete_requests.product_id already correct type — skip';
  END IF;
END $$;
