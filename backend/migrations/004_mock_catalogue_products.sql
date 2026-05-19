-- Migration 004: Seed mock catalogue products so the ToyMall demo checkout works.
-- Mock product IDs (p1-p15) are inserted into the real products table, mapped
-- to the 8 real tenants (T001-T008). Barcode uses MOCK- prefix to avoid collision.
-- storeIds[0] → tenant mapping:
--   s1 → T001 (ToysWorld)    s2 → T002 (SpeedZone)  s3 → T003 (BrickMaster)
--   s4 → T004 (ActionHeroes) s5 → T005 (PuzzleKingdom) s6 → T006 (ScaleCars)
--   s7 → T007 (EduPlayZone)  s8 → T008 (CollectorsHub)

INSERT INTO products
  (product_id, product_name, category, price, tenant_id, barcode, stock_quantity, stock_status, is_active)
VALUES
  ('p1',  'Barbie Dreamhouse',  'Doll',     450000,  'T001', 'MOCK-P01', 12, 'AVAILABLE',     TRUE),
  ('p2',  'BJD Articulated',    'Doll',     820000,  'T005', 'MOCK-P02',  4, 'AVAILABLE',     TRUE),
  ('p3',  'Plush Bunny XL',     'Doll',     210000,  'T001', 'MOCK-P03',  0, 'OUT_OF_STOCK', TRUE),
  ('p4',  'Fashion Doll Set',   'Doll',     320000,  'T003', 'MOCK-P04',  7, 'AVAILABLE',     TRUE),
  ('p5',  'LEGO City 500pcs',   'Brick',    680000,  'T003', 'MOCK-P05', 15, 'AVAILABLE',     TRUE),
  ('p6',  'Nanoblock Tower',    'Brick',    290000,  'T002', 'MOCK-P06',  0, 'OUT_OF_STOCK', TRUE),
  ('p7',  'Magnetic Tiles 60',  'Brick',    380000,  'T001', 'MOCK-P07',  3, 'AVAILABLE',     TRUE),
  ('p8',  'Technic Expert',     'Brick',   1200000,  'T005', 'MOCK-P08',  9, 'AVAILABLE',     TRUE),
  ('p9',  'Molly Series 1',     'Art toys', 540000,  'T007', 'MOCK-P09',  6, 'AVAILABLE',     TRUE),
  ('p10', 'Dunny Blind Box',    'Art toys', 180000,  'T007', 'MOCK-P10',  0, 'OUT_OF_STOCK', TRUE),
  ('p11', 'Qee Designer',       'Art toys', 420000,  'T007', 'MOCK-P11',  2, 'AVAILABLE',     TRUE),
  ('p12', 'Gundam MG 1/100',   'Hobbies',  920000,  'T005', 'MOCK-P12', 11, 'AVAILABLE',     TRUE),
  ('p13', 'RC Car Drift',       'Hobbies',  650000,  'T002', 'MOCK-P13',  5, 'AVAILABLE',     TRUE),
  ('p14', 'Puzzle 1000pcs',     'Hobbies',  185000,  'T001', 'MOCK-P14',  8, 'AVAILABLE',     TRUE),
  ('p15', 'Die-cast Mini',      'Hobbies',  340000,  'T002', 'MOCK-P15',  0, 'OUT_OF_STOCK', TRUE)
ON CONFLICT (product_id) DO UPDATE SET
  product_name    = EXCLUDED.product_name,
  category        = EXCLUDED.category,
  price           = EXCLUDED.price,
  tenant_id       = EXCLUDED.tenant_id,
  stock_quantity  = EXCLUDED.stock_quantity,
  stock_status    = EXCLUDED.stock_status,
  is_active       = EXCLUDED.is_active;
