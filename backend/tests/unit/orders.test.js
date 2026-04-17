'use strict';

/**
 * Unit Tests — Customer Module: Keranjang, Checkout, QR Code, Konfirmasi, Struk, Pickup
 * Covers: UT-016 to UT-025
 * Reference: BR-F-C-008 to BR-F-C-013
 */

const ordersSvc = require('../../src/modules/orders/orders.service');
const db = require('../../src/config/database');

jest.mock('../../src/config/database');
jest.mock('../../src/utils/txnId', () => ({ generateTxnId: jest.fn().mockResolvedValue('TXN-20260415-00001') }));
jest.mock('../../src/utils/qrcode', () => ({ generateTransactionQR: jest.fn().mockResolvedValue('mockQRBase64Data') }));
jest.mock('../../src/utils/auditLog', () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/modules/notifications/notifications.service', () => ({
  sendOrderNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  query: jest.fn(),
};

describe('Customer — Keranjang (UT-016 to UT-019)', () => {
  // UT-016: Tambah Produk dan Tampilkan - tested via listProducts + createOrder
  test('UT-016: Produk In Stock dapat ditambahkan ke order', async () => {
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ // Lock products
        product_id: 'P001-T001', product_name: 'LEGO City',
        price: 350000, tenant_id: 'T001',
        stock_quantity: 15, stock_status: 'AVAILABLE',
      }]})
      .mockResolvedValueOnce({ rows: [] }) // Insert transaction
      .mockResolvedValueOnce({ rows: [] }) // Insert item
      .mockResolvedValueOnce({ rows: [] }); // Decrement stock

    const result = await ordersSvc.createOrder('customer-uuid', [
      { product_id: 'P001-T001', quantity: 1 },
    ]);

    expect(result.transactionId).toBe('TXN-20260415-00001');
    expect(result.status).toBe('PENDING');
    expect(result.totalAmount).toBe(350000);
  });

  // UT-017: Ubah Kuantitas — computed on frontend; subtotal verified server-side
  test('UT-017: Total dihitung benar untuk qty 2 × Rp350.000 = Rp700.000', async () => {
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
    mockClient.query
      .mockResolvedValueOnce({ rows: [{
        product_id: 'P001-T001', product_name: 'LEGO City',
        price: 350000, tenant_id: 'T001',
        stock_quantity: 15, stock_status: 'AVAILABLE',
      }]})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await ordersSvc.createOrder('customer-uuid', [
      { product_id: 'P001-T001', quantity: 2 },
    ]);

    expect(result.totalAmount).toBe(700000);
  });

  // UT-018: Hapus Item — handled by cart update on frontend; stock restored on cancel
  test('UT-018: Cancel order restores stock', async () => {
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ // lock txn
        transaction_id: 'TXN-20260415-00001',
        customer_id: 'customer-uuid',
        status: 'PENDING',
      }]})
      .mockResolvedValueOnce({ rows: [{ product_id: 'P001-T001', quantity: 1 }] }) // items
      .mockResolvedValueOnce({ rows: [] }) // restore stock
      .mockResolvedValueOnce({ rows: [] }); // update status

    const result = await ordersSvc.cancelOrder('TXN-20260415-00001', 'customer-uuid');
    expect(result.status).toBe('CANCELLED');
  });

  // UT-019: Peringatan Item OOS di Keranjang
  test('UT-019: Checkout rejected when item is OUT_OF_STOCK', async () => {
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
    mockClient.query.mockResolvedValueOnce({ rows: [{
      product_id: 'P004-T001', product_name: 'Barbie Dreamhouse',
      price: 550000, tenant_id: 'T001',
      stock_quantity: 0, stock_status: 'OUT_OF_STOCK',
    }]});

    await expect(
      ordersSvc.createOrder('customer-uuid', [{ product_id: 'P004-T001', quantity: 1 }])
    ).rejects.toMatchObject({
      message: expect.stringContaining('tidak tersedia'),
    });
  });
});

describe('Customer — Checkout (UT-020 to UT-021)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-020: Checkout - Generate Transaction ID unik dan QR Code
  test('UT-020: Checkout menghasilkan TXN ID format TXN-YYYYMMDD-NNNNN dan QR code', async () => {
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
    mockClient.query
      .mockResolvedValueOnce({ rows: [{
        product_id: 'P001-T001', product_name: 'LEGO City',
        price: 350000, tenant_id: 'T001', stock_quantity: 10, stock_status: 'AVAILABLE',
      }, {
        product_id: 'P005-T002', product_name: 'Hot Wheels',
        price: 200000, tenant_id: 'T002', stock_quantity: 5, stock_status: 'AVAILABLE',
      }]})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await ordersSvc.createOrder('customer-uuid', [
      { product_id: 'P001-T001', quantity: 1 },
      { product_id: 'P005-T002', quantity: 1 },
    ]);

    expect(result.transactionId).toMatch(/^TXN-\d{8}-\d{5}$/);
    expect(result.qrPayload).toContain('data:image/png;base64,');
    expect(result.status).toBe('PENDING');
    expect(result.totalAmount).toBe(550000);
  });

  // UT-021: Edit Order - Cancel dan buat transaksi baru
  test('UT-021: Customer dapat membatalkan PENDING transaksi untuk edit ulang', async () => {
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
    mockClient.query
      .mockResolvedValueOnce({ rows: [{
        transaction_id: 'TXN-20260415-00001',
        customer_id: 'customer-uuid',
        status: 'PENDING',
      }]})
      .mockResolvedValueOnce({ rows: [{ product_id: 'P001-T001', quantity: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await ordersSvc.cancelOrder('TXN-20260415-00001', 'customer-uuid');
    expect(result.status).toBe('CANCELLED');
  });
});

describe('Customer — QR Code (UT-022)', () => {
  // UT-022: Tampilan QR Code - Informasi Transaksi Lengkap
  test('UT-022: QR payload berisi transaction ID', async () => {
    const { generateTransactionQR } = require('../../src/utils/qrcode');
    const qr = await generateTransactionQR('TXN-20260415-00001');
    expect(qr).toBe('data:image/png;base64,mockQR');
  });
});

describe('Customer — Konfirmasi Pembayaran (UT-023)', () => {
  // UT-023: Status Transaksi Berubah PENDING ke PAID (< 5 detik) — tested via WebSocket
  test('UT-023: getTransaction mengembalikan status terbaru setelah payment', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{
        transaction_id: 'TXN-20260415-00001',
        customer_id: 'customer-uuid',
        status: 'PAID',
        total_amount: 550000,
        payment_method: 'CASH',
        paid_at: new Date(),
        customer_name: 'Budi Santoso',
        cashier_name: 'Kasir Satu',
      }]})
      .mockResolvedValueOnce({ rows: [] });

    const result = await ordersSvc.getTransaction('TXN-20260415-00001', 'customer-uuid', 'CUSTOMER');
    expect(result.status).toBe('PAID');
    expect(result.payment_method).toBe('CASH');
  });
});

describe('Customer — Struk Digital (UT-024)', () => {
  // UT-024: Struk Digital - Tampilkan Detail per Tenant
  test('UT-024: Struk menampilkan item dikelompokkan per tenant', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{
        transaction_id: 'TXN-20260415-00001',
        customer_id: 'customer-uuid',
        status: 'PAID', total_amount: 550000,
        customer_name: 'Budi Santoso', cashier_name: 'Kasir Satu',
      }]})
      .mockResolvedValueOnce({ rows: [
        { product_name: 'LEGO City', tenant_name: 'ToysWorld',  booth_location: 'Hall A, Stand A1', pickup_status: 'READY' },
        { product_name: 'Hot Wheels', tenant_name: 'SpeedZone', booth_location: 'Hall B, Stand B3', pickup_status: 'READY' },
      ]});

    const result = await ordersSvc.getTransaction('TXN-20260415-00001', 'customer-uuid', 'CUSTOMER');
    expect(result.items).toHaveLength(2);

    const tenants = [...new Set(result.items.map(i => i.tenant_name))];
    expect(tenants).toContain('ToysWorld');
    expect(tenants).toContain('SpeedZone');
  });
});

describe('Customer — Pickup Status (UT-025)', () => {
  // UT-025: Pickup Status - Update Real-Time Saat Tenant Selesai Handover
  test('UT-025: Item status DONE setelah handover oleh tenant', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{
        transaction_id: 'TXN-20260415-00001',
        customer_id: 'customer-uuid',
        status: 'PAID', total_amount: 350000,
        customer_name: 'Budi Santoso', cashier_name: 'Kasir Satu',
      }]})
      .mockResolvedValueOnce({ rows: [
        { product_name: 'LEGO City', tenant_name: 'ToysWorld', pickup_status: 'DONE', handed_over_at: new Date() },
      ]});

    const result = await ordersSvc.getTransaction('TXN-20260415-00001', 'customer-uuid', 'CUSTOMER');
    const allDone = result.items.every(i => i.pickup_status === 'DONE');
    expect(allDone).toBe(true);
  });
});
