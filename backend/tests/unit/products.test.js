'use strict';

/**
 * Unit Tests — Customer Module: Browse, Scan, Search, Detail Produk
 * Covers: UT-007 to UT-015
 * Reference: BR-F-C-003 to BR-F-C-007
 */

const productsSvc = require('../../src/modules/products/products.service');
const db = require('../../src/config/database');

jest.mock('../../src/config/database');

const mockProducts = [
  {
    product_id: 'P001-T001', product_name: 'LEGO City 60350', category: 'Lego',
    price: 250000, stock_quantity: 15, stock_status: 'AVAILABLE',
    tenant_id: 'T001', tenant_name: 'ToysWorld', booth_location: 'Hall A, Stand A1', floor_label: 'GF',
  },
  {
    product_id: 'P004-T001', product_name: 'Barbie Dreamhouse', category: 'Boneka',
    price: 180000, stock_quantity: 0, stock_status: 'OUT_OF_STOCK',
    tenant_id: 'T001', tenant_name: 'ToysWorld', booth_location: 'Hall A, Stand A1', floor_label: 'GF',
  },
];

describe('Customer — Browse Produk (UT-007)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-007: Browse - Tampilkan Daftar Tenant per Lantai
  test('UT-007: Halaman Browse menampilkan produk dengan tenant info', async () => {
    db.query
      .mockResolvedValueOnce({ rows: mockProducts })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await productsSvc.listProducts({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toHaveProperty('tenant_name');
    expect(result.items[0]).toHaveProperty('floor_label');
    expect(result.total).toBe(2);
  });
});

describe('Customer — Galeri Produk Tenant (UT-008 to UT-009)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-008: Galeri Produk - Tampilkan Produk Tenant
  test('UT-008: Galeri menampilkan produk dengan status stok (termasuk OOS)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: mockProducts })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await productsSvc.listProducts({ tenantId: 'T001' });

    const availableProduct = result.items.find(p => p.stock_status === 'AVAILABLE');
    const oosProduct       = result.items.find(p => p.stock_status === 'OUT_OF_STOCK');

    expect(availableProduct).toBeDefined();
    expect(oosProduct).toBeDefined();
    expect(oosProduct.stock_quantity).toBe(0);
  });

  // UT-009: Galeri Produk - Filter berdasarkan Kategori
  test('UT-009: Filter kategori "Lego" hanya menampilkan produk Lego', async () => {
    const legoOnly = [mockProducts[0]];
    db.query
      .mockResolvedValueOnce({ rows: legoOnly })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const result = await productsSvc.listProducts({ category: 'Lego' });

    expect(result.items.every(p => p.category === 'Lego')).toBe(true);
    expect(result.total).toBe(1);
  });
});

describe('Customer — Scan Barcode (UT-010 to UT-011)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-010: Scan Barcode Produk - Barcode Valid
  test('UT-010: Scan barcode valid membuka detail produk yang sesuai', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...mockProducts[0], barcode: '8999999001234' }] });

    const result = await productsSvc.getProductByBarcode('8999999001234');

    expect(result.product_id).toBe('P001-T001');
    expect(result.product_name).toBe('LEGO City 60350');
  });

  // UT-011: Scan Barcode Produk - Barcode Tidak Dikenali
  test('UT-011: Scan barcode tidak terdaftar menampilkan pesan tidak ditemukan', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(productsSvc.getProductByBarcode('0000000000000')).rejects.toMatchObject({
      message: 'Produk tidak ditemukan, silakan cari manual.',
      statusCode: 404,
    });
  });
});

describe('Customer — Pencarian Manual (UT-012 to UT-013)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-012: Pencarian Manual - Kata Kunci Valid (Nama Produk)
  test('UT-012: Pencarian "Gundam" menampilkan produk relevan', async () => {
    const gundamProducts = [
      { product_id: 'P008-T003', product_name: 'Gundam RX-78-2 MG', category: 'Action Figure' },
      { product_id: 'P009-T003', product_name: 'Gundam Wing Zero HG', category: 'Action Figure' },
    ];
    db.query
      .mockResolvedValueOnce({ rows: gundamProducts })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await productsSvc.listProducts({ search: 'Gundam' });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every(p => p.product_name.includes('Gundam'))).toBe(true);
  });

  // UT-013: Pencarian Manual - Tidak Ada Hasil
  test('UT-013: Pencarian kata kunci tidak ada mengembalikan array kosong', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const result = await productsSvc.listProducts({ search: 'XYZ12345QWERTY' });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('Customer — Detail Produk (UT-014 to UT-015)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-014: Detail Produk - Tampilan Lengkap In Stock
  test('UT-014: Detail produk In Stock menampilkan semua informasi', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockProducts[0]] });

    const result = await productsSvc.getProductById('P001-T001');

    expect(result.stock_status).toBe('AVAILABLE');
    expect(result.price).toBe(250000);
    expect(result).toHaveProperty('tenant_name');
    expect(result).toHaveProperty('booth_location');
  });

  // UT-015: Detail Produk - Tombol Nonaktif untuk Out of Stock
  test('UT-015: Produk OOS memiliki stock_status OUT_OF_STOCK', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockProducts[1]] });

    const result = await productsSvc.getProductById('P004-T001');

    expect(result.stock_status).toBe('OUT_OF_STOCK');
    expect(result.stock_quantity).toBe(0);
    // Frontend should disable the "Tambah ke Keranjang" button when stock_status = 'OUT_OF_STOCK'
  });
});
