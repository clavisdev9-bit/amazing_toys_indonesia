-- =============================================================================
-- SEED DATA — Amazing Toys Fair 2026
-- Run AFTER schema.sql
-- =============================================================================

-- Tenants (sample data matching prototype)
INSERT INTO tenants (tenant_id, tenant_name, booth_location, floor_label, contact_name, contact_phone, revenue_share_pct) VALUES
('T001', 'ToysWorld',      'Hall A, Stand A1',  'GF', 'Andi Kurniawan',   '081200001111', 100.00),
('T002', 'SpeedZone',      'Hall B, Stand B3',  'GF', 'Budi Hartono',     '081200002222', 100.00),
('T003', 'BrickMaster',    'Hall A, Stand A4',  'GF', 'Citra Dewi',       '081200003333', 100.00),
('T004', 'ActionHeroes',   'Hall C, Stand C2',  '2F', 'Deni Saputra',     '081200004444', 100.00),
('T005', 'PuzzleKingdom',  'Hall B, Stand B7',  'GF', 'Eka Wulandari',    '081200005555', 100.00),
('T006', 'ScaleCars',      'Hall A, Stand A8',  'UG', 'Fajar Nugroho',    '081200006666', 100.00),
('T007', 'EduPlayZone',    'Hall C, Stand C5',  '2F', 'Gita Rahayu',      '081200007777', 100.00),
('T008', 'CollectorsHub',  'Hall B, Stand B2',  'GF', 'Hendra Wijaya',    '081200008888', 100.00);

-- Products
INSERT INTO products (product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url) VALUES
('P001-T001', 'LEGO City 60350 Moon Base',          'Lego',           350000.00, 'T001', '8999999001234', 15, NULL),
('P002-T001', 'LEGO Technic 42138',                 'Lego',           480000.00, 'T001', '8999999001235', 8,  NULL),
('P003-T001', 'LEGO Duplo Safari',                  'Duplo',          220000.00, 'T001', '8999999001236', 3,  NULL),
('P004-T001', 'Barbie Dreamhouse',                  'Boneka',         550000.00, 'T001', '8999999001237', 0,  NULL),
('P005-T002', 'Hot Wheels Track Builder',           'Diecast',        180000.00, 'T002', '8999999002001', 20, NULL),
('P006-T002', 'Hot Wheels Rare Edition',            'Diecast',        350000.00, 'T002', '8999999002002', 0,  NULL),
('P007-T002', 'Scale Model BMW M3',                 'Diecast',        275000.00, 'T002', '8999999002003', 12, NULL),
('P008-T003', 'Gundam RX-78-2 MG',                 'Action Figure',  420000.00, 'T003', '8999999003001', 6,  NULL),
('P009-T003', 'Gundam Wing Zero HG',               'Action Figure',  195000.00, 'T003', '8999999003002', 10, NULL),
('P010-T004', 'Marvel Iron Man Figure',             'Action Figure',  310000.00, 'T004', '8999999004001', 7,  NULL),
('P011-T005', 'Puzzle Landscape 1000pcs',           'Puzzle',         145000.00, 'T005', '8999999005001', 25, NULL),
('P012-T005', 'Board Game Monopoly Classic',        'Board Games',    280000.00, 'T005', '8999999005002', 9,  NULL),
('P013-T006', 'Scale Car Ferrari F40 1:18',         'Diecast',        650000.00, 'T006', '8999999006001', 4,  NULL),
('P014-T007', 'Edu Science Chemistry Set',          'Edukatif',       320000.00, 'T007', '8999999007001', 11, NULL),
('P015-T007', 'Outdoor Bubble Kit XL',              'Outdoor',        125000.00, 'T007', '8999999007002', 30, NULL);

-- Users (cashiers + leaders; passwords are bcrypt of 'password123')
INSERT INTO users (user_id, username, password_hash, role, display_name) VALUES
(gen_random_uuid(), 'kasir01',  '$2b$10$QJ1eTOg5fFAVfywbJD14ru0ZwpXcj.Isi3n9Xk2KG0ZOEMk6GBRF.', 'CASHIER', 'Kasir Satu'),
(gen_random_uuid(), 'kasir02',  '$2b$10$QJ1eTOg5fFAVfywbJD14ru0ZwpXcj.Isi3n9Xk2KG0ZOEMk6GBRF.', 'CASHIER', 'Kasir Dua'),
(gen_random_uuid(), 'leader01', '$2b$10$QJ1eTOg5fFAVfywbJD14ru0ZwpXcj.Isi3n9Xk2KG0ZOEMk6GBRF.', 'LEADER',  'Aristya Rahadiyan'),
(gen_random_uuid(), 'tenant_t001', '$2b$10$QJ1eTOg5fFAVfywbJD14ru0ZwpXcj.Isi3n9Xk2KG0ZOEMk6GBRF.', 'TENANT', 'ToysWorld Portal');

-- Update tenant_id for tenant user
UPDATE users SET tenant_id = 'T001' WHERE username = 'tenant_t001';
