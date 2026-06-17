/**
 * Test 5: Double Payment Protection
 * Mensimulasikan race condition: 5 kasir mencoba bayar order yang SAMA secara bersamaan.
 * Hanya 1 yang boleh berhasil; sisanya harus mendapat 409.
 *
 * Alur:
 *   1. setup() buat 1 order via Helper
 *   2. 5 VU bersamaan panggil processPayment untuk order yang sama
 *   3. Validasi: tepat 1 sukses, 4 mendapat 409
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { API, THRESHOLDS } from './config.js';

const doublePaymentBlocked = new Counter('double_payment_blocked');
const doublePaymentPassed  = new Counter('double_payment_passed');
const raceErrors           = new Rate('race_condition_errors');

export const options = {
  scenarios: {
    double_pay: {
      executor: 'shared-iterations',
      vus: 5,           // 5 kasir bersamaan
      iterations: 5,    // 5 total (1 per VU)
      maxDuration: '30s',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    double_payment_blocked: ['count>=4'],    // minimal 4 dari 5 harus diblokir
    double_payment_passed:  ['count<=1'],    // maksimal 1 boleh berhasil
    race_condition_errors:  ['rate<0.05'],
  },
};

// Dibuat sekali di setup(), dipakai semua VU
export function setup() {
  // Login helper
  const helperRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username: 'helper_stress01', password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (helperRes.status !== 200) {
    console.error('Setup: helper login gagal');
    return { transactionId: null };
  }
  const helperToken = helperRes.json('data.token');

  // Ambil produk
  const prodRes = http.get(`${API}/products?limit=5`, {
    headers: { 'Authorization': `Bearer ${helperToken}`, 'Content-Type': 'application/json' },
  });
  const items = prodRes.json('data.items') ?? prodRes.json('data') ?? [];
  const product = items.find(p => p.stock_quantity > 0);
  if (!product) {
    console.error('Setup: tidak ada produk tersedia');
    return { transactionId: null };
  }

  // Buat 1 order yang akan jadi target double-pay
  const orderRes = http.post(
    `${API}/helper/orders`,
    JSON.stringify({
      customerPhone: '089999000001',
      items: [{ productId: product.product_id, quantity: 1 }],
    }),
    { headers: { 'Authorization': `Bearer ${helperToken}`, 'Content-Type': 'application/json' } },
  );

  if (orderRes.status !== 200 && orderRes.status !== 201) {
    console.error('Setup: gagal buat order', orderRes.status, orderRes.body);
    return { transactionId: null };
  }

  const transactionId = orderRes.json('data.transactionId');
  console.log(`Setup: order dibuat → ${transactionId}`);
  return { transactionId };
}

export default function (data) {
  if (!data.transactionId) {
    raceErrors.add(1);
    return;
  }

  // Setiap VU login sebagai kasir berbeda
  const users = ['kasir_stress01','kasir_stress02','kasir_stress03','kasir_stress04','kasir_stress05'];
  const username = users[__VU % users.length];

  const loginRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username, password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (loginRes.status !== 200) { raceErrors.add(1); return; }
  const token = loginRes.json('data.token');

  // Semua VU coba bayar order yang SAMA secara bersamaan
  // (tidak ada sleep — maksimalkan race condition)
  const res = http.post(
    `${API}/payments/process`,
    JSON.stringify({
      transaction_id: data.transactionId,
      payment_method: 'QRIS',
    }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } },
  );

  if (res.status === 200) {
    doublePaymentPassed.add(1);
    check(res, {
      'Pembayaran pertama berhasil (200)': (r) => r.status === 200,
      'Status PAID':                       (r) => r.json('data.status') === 'PAID',
    });

  } else if (res.status === 409) {
    doublePaymentBlocked.add(1);
    check(res, {
      'Double payment diblokir (409)': (r) => r.status === 409,
      'Pesan error ada':               (r) => !!r.json('message'),
    });

  } else {
    raceErrors.add(1);
    check(res, {
      'Unexpected status (bukan 200/409)': () => false,
    });
    console.log(`VU ${__VU}: unexpected status ${res.status} — ${res.body}`);
  }
}

export function teardown(data) {
  if (data.transactionId) {
    console.log(`Teardown: order ${data.transactionId} selesai diuji`);
  }
}
