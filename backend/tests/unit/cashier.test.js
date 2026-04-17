'use strict';

/**
 * Unit Tests — Cashier Module: Scan, Review, Pembayaran Tunai, QRIS/EDC, Cetak, Rekap
 * Covers: UT-026 to UT-040
 * Reference: BR-F-K-001 to BR-F-K-009
 */

const paymentsSvc = require('../../src/modules/payments/payments.service');
const cashierSvc  = require('../../src/modules/cashier/cashier.service');
const db = require('../../src/config/database');

jest.mock('../../src/config/database');
jest.mock('../../src/utils/auditLog', () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/modules/notifications/notifications.service', () => ({
  sendOrderNotification: jest.fn().mockResolvedValue(undefined),
}));

const PENDING_TXN = {
  transaction_id: 'TXN-20260415-00001',
  status: 'PENDING',
  total_amount: 550000,
  expires_at: new Date(Date.now() + 30 * 60 * 1000),
  customer_name: 'Budi Santoso',
  customer_phone: '08123456789',
  checkout_time: new Date(),
};

describe('Kasir — Identifikasi Transaksi (UT-026 to UT-029)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-026: Scan QR Code Customer - Berhasil
  test('UT-026: Scan QR Code menampilkan detail transaksi PENDING dalam < 2 detik (mock)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [PENDING_TXN] })
      .mockResolvedValueOnce({ rows: [
        { quantity: 1, unit_price: 350000, subtotal: 350000, product_name: 'LEGO City', tenant_name: 'ToysWorld' },
        { quantity: 1, unit_price: 200000, subtotal: 200000, product_name: 'Hot Wheels', tenant_name: 'SpeedZone' },
      ]});

    const result = await paymentsSvc.lookupTransaction('TXN-20260415-00001');

    expect(result.transaction_id).toBe('TXN-20260415-00001');
    expect(result.customer_name).toBe('Budi Santoso');
    expect(result.items).toHaveLength(2);
  });

  // UT-027: Pencarian Manual - Transaction ID
  test('UT-027: Pencarian manual TXN ID menemukan transaksi', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [PENDING_TXN] })
      .mockResolvedValueOnce({ rows: [
        { quantity: 1, unit_price: 550000, subtotal: 550000, product_name: 'Bundle', tenant_name: 'ToysWorld' },
      ]});

    const result = await paymentsSvc.lookupTransaction('TXN-20260415-00001');
    expect(result.transaction_id).toBe('TXN-20260415-00001');
  });

  // UT-028: Pencarian - Transaksi Tidak Ditemukan
  test('UT-028: Pencarian TXN tidak ada menghasilkan error 404', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(paymentsSvc.lookupTransaction('TXN-99999')).rejects.toMatchObject({
      message: 'Transaksi tidak ditemukan.',
      statusCode: 404,
    });
  });

  // UT-029: Pencarian - Transaksi Berstatus PAID Ditolak
  test('UT-029: Transaksi berstatus PAID tidak dapat diproses ulang', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      ...PENDING_TXN,
      status: 'PAID',
    }]});

    await expect(paymentsSvc.lookupTransaction('TXN-20260415-00001')).rejects.toMatchObject({
      message: 'Transaksi sudah diproses.',
      statusCode: 409,
    });
  });
});

describe('Kasir — Review Pesanan (UT-030)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-030: Review Pesanan - Tampilkan Detail Lengkap
  test('UT-030: Layar review menampilkan semua informasi transaksi', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [PENDING_TXN] })
      .mockResolvedValueOnce({ rows: [
        { quantity: 1, unit_price: 350000, subtotal: 350000, product_name: 'LEGO City', tenant_id: 'T001', tenant_name: 'ToysWorld', booth_location: 'Hall A' },
        { quantity: 1, unit_price: 200000, subtotal: 200000, product_name: 'Hot Wheels', tenant_id: 'T002', tenant_name: 'SpeedZone', booth_location: 'Hall B' },
      ]});

    const result = await paymentsSvc.lookupTransaction('TXN-20260415-00001');

    expect(result.total_amount).toBe(550000);
    expect(result.items.reduce((s, i) => s + i.subtotal, 0)).toBe(550000);
    expect(result.customer_name).toBeDefined();
  });
});

describe('Kasir — Pembayaran Tunai (UT-031 to UT-032)', () => {
  const mockClient = { query: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
  });

  // UT-031: Pembayaran Tunai - Hitung Kembalian Otomatis
  test('UT-031: Kembalian dihitung otomatis: Rp600.000 - Rp550.000 = Rp50.000', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ ...PENDING_TXN }] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // update PAID
      .mockResolvedValueOnce({ rows: [] }) // session upsert
      .mockResolvedValueOnce({ rows: [{ tenant_id: 'T001', tenant_name: 'ToysWorld', notification_device_token: null }] });

    const result = await paymentsSvc.processPayment({
      transactionId: 'TXN-20260415-00001',
      paymentMethod: 'CASH',
      cashReceived: 600000,
      cashierId: 'cashier-uuid',
    });

    expect(result.cashChange).toBe(50000);
    expect(result.status).toBe('PAID');
  });

  // UT-032: Pembayaran Tunai - Jumlah Kurang dari Total
  test('UT-032: Pembayaran tunai kurang dari total diblokir', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ ...PENDING_TXN }] });

    await expect(paymentsSvc.processPayment({
      transactionId: 'TXN-20260415-00001',
      paymentMethod: 'CASH',
      cashReceived: 400000, // less than 550000
      cashierId: 'cashier-uuid',
    })).rejects.toMatchObject({
      message: 'Jumlah diterima kurang dari total pembayaran.',
    });
  });
});

describe('Kasir — Pembayaran QRIS / EDC (UT-033 to UT-035)', () => {
  const mockClient = { query: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    db.withTransaction.mockImplementation((fn) => fn(mockClient));
  });

  // UT-033: Pembayaran QRIS
  test('UT-033: Pembayaran QRIS berhasil dengan payment reference', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ ...PENDING_TXN }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ tenant_id: 'T001', notification_device_token: null }] });

    const result = await paymentsSvc.processPayment({
      transactionId: 'TXN-20260415-00001',
      paymentMethod: 'QRIS',
      paymentRef: 'QRIS-REF-123456',
      cashierId: 'cashier-uuid',
    });

    expect(result.status).toBe('PAID');
    expect(result.paymentMethod).toBe('QRIS');
    expect(result.cashChange).toBeNull();
  });

  // UT-034: Pembayaran EDC
  test('UT-034: Pembayaran EDC berhasil dengan approval code', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ ...PENDING_TXN }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ tenant_id: 'T001', notification_device_token: null }] });

    const result = await paymentsSvc.processPayment({
      transactionId: 'TXN-20260415-00001',
      paymentMethod: 'EDC',
      paymentRef: 'EDC-APPROVAL-789',
      cashierId: 'cashier-uuid',
    });

    expect(result.paymentMethod).toBe('EDC');
  });

  // UT-035: Pembayaran Transaksi Kadaluarsa
  test('UT-035: Pembayaran transaksi expired diblokir', async () => {
    const expiredTxn = {
      ...PENDING_TXN,
      expires_at: new Date(Date.now() - 60000), // expired 1 min ago
    };
    mockClient.query.mockResolvedValueOnce({ rows: [expiredTxn] });

    await expect(paymentsSvc.processPayment({
      transactionId: 'TXN-20260415-00001',
      paymentMethod: 'CASH',
      cashReceived: 600000,
      cashierId: 'cashier-uuid',
    })).rejects.toMatchObject({ statusCode: 410 });
  });
});

describe('Kasir — Notifikasi Tenant (UT-036)', () => {
  // UT-036: Notifikasi Tenant Dikirim Setelah Pembayaran PAID
  test('UT-036: sendOrderNotification dipanggil untuk setiap tenant dalam order', async () => {
    const notifSvc = require('../../src/modules/notifications/notifications.service');
    const mockClient2 = { query: jest.fn() };
    db.withTransaction.mockImplementation((fn) => fn(mockClient2));
    mockClient2.query
      .mockResolvedValueOnce({ rows: [{ ...PENDING_TXN }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [
        { tenant_id: 'T001', tenant_name: 'ToysWorld', notification_device_token: null },
        { tenant_id: 'T002', tenant_name: 'SpeedZone', notification_device_token: null },
      ]});

    await paymentsSvc.processPayment({
      transactionId: 'TXN-20260415-00001',
      paymentMethod: 'CASH',
      cashReceived: 600000,
      cashierId: 'cashier-uuid',
    });

    // Give the fire-and-forget promises time to run
    await new Promise(r => setTimeout(r, 50));
    expect(notifSvc.sendOrderNotification).toHaveBeenCalledTimes(2);
  });
});

describe('Kasir — Rekap Harian (UT-037 to UT-040)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-037: Rekap Kasir - Tampilkan Ringkasan Shift
  test('UT-037: Rekap harian menampilkan total per metode pembayaran', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      cashier_id: 'cashier-uuid',
      shift_date: '2026-04-15',
      txn_count: 42,
      total_cash: 5200000,
      total_qris: 3100000,
      total_edc: 1800000,
      total_transfer: 0,
      display_name: 'Kasir Satu',
    }]});

    const result = await cashierSvc.getDailyRecap('cashier-uuid', '2026-04-15');

    expect(result.txn_count).toBe(42);
    expect(result.grand_total).toBe(10100000);
  });

  // UT-038: Rekap - Shift Belum Ada Data
  test('UT-038: Rekap kosong mengembalikan zeroed values', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await cashierSvc.getDailyRecap('cashier-uuid', '2026-04-16');

    expect(result.txn_count).toBe(0);
    expect(result.grand_total).toBe(0);
  });

  // UT-039: Kasir - Daftar Transaksi Hari Ini
  test('UT-039: Daftar transaksi kasir hari ini menampilkan hanya status PAID', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { transaction_id: 'TXN-20260415-00001', status: 'PAID', total_amount: 550000, payment_method: 'CASH' },
      { transaction_id: 'TXN-20260415-00002', status: 'PAID', total_amount: 300000, payment_method: 'QRIS' },
    ]});

    const result = await cashierSvc.getCashierTransactions('cashier-uuid', '2026-04-15');
    expect(result.every(t => t.status === 'PAID')).toBe(true);
    expect(result).toHaveLength(2);
  });

  // UT-040: Rekap - Grand Total Konsisten
  test('UT-040: Grand total = sum(cash + qris + edc + transfer)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      txn_count: 10, total_cash: 1000000, total_qris: 500000,
      total_edc: 300000, total_transfer: 200000,
    }]});

    const result = await cashierSvc.getDailyRecap('cashier-uuid');
    expect(result.grand_total).toBe(2000000);
  });
});
