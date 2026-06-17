/**
 * Test 2: Full Order Flow — 100 Virtual Users bersamaan
 * Setiap VU mensimulasikan 1 helper yang membuat order walk-in
 * kemudian 1 cashier yang memproses pembayaran.
 *
 * Alur: Login Helper → Ambil Produk → Buat Order → Login Kasir → Lookup → Bayar
 * Target: semua order terproses, p(95) < 3000ms per step.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { API, THRESHOLDS, fakePhone } from './config.js';

const orderCreated   = new Counter('orders_created');
const orderPaid      = new Counter('orders_paid');
const orderErrors    = new Rate('order_errors');
const helperLatency  = new Trend('helper_create_ms', true);
const paymentLatency = new Trend('payment_process_ms', true);

export const options = {
  scenarios: {
    order_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 25  },
        { duration: '40s', target: 100 },
        { duration: '120s', target: 100 },
        { duration: '20s', target: 0  },
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    orders_paid:       ['count>50'],         // minimal 50 order berhasil dibayar
    order_errors:      ['rate<0.05'],        // < 5% error (lebih toleran karena alur panjang)
    helper_create_ms:  ['p(95)<3000'],
    payment_process_ms: ['p(95)<3000'],
  },
};

const HEADERS = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
});

function loginAsHelper() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username: 'helper_stress01', password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) return null;
  return res.json('data.token');
}

function loginAsCashier(idx) {
  const users = ['kasir_stress01','kasir_stress02','kasir_stress03','kasir_stress04','kasir_stress05'];
  const username = users[idx % users.length];
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username, password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) return null;
  return res.json('data.token');
}

function getFirstProduct(token) {
  const res = http.get(`${API}/products?limit=5`, { headers: HEADERS(token) });
  if (res.status !== 200) return null;
  const items = res.json('data.items') ?? res.json('data') ?? [];
  const available = items.filter(p => p.stock_quantity > 0);
  return available[0] ?? null;
}

export default function () {
  let helperToken, cashierToken, product, transactionId;

  // ── Step 1: Login Helper ──────────────────────────────────────────────────
  group('1_helper_login', () => {
    helperToken = loginAsHelper();
    check(helperToken, { 'helper login ok': (t) => !!t });
  });
  if (!helperToken) { orderErrors.add(1); return; }

  sleep(0.5);

  // ── Step 2: Ambil produk ──────────────────────────────────────────────────
  group('2_get_products', () => {
    product = getFirstProduct(helperToken);
    check(product, { 'produk tersedia': (p) => !!p });
  });
  if (!product) { orderErrors.add(1); return; }

  sleep(0.3);

  // ── Step 3: Helper buat order walk-in ─────────────────────────────────────
  group('3_create_order', () => {
    const phone = fakePhone(__VU);
    const body = {
      customerPhone: phone,
      items: [{ productId: product.product_id, quantity: 1 }],
    };
    const start = Date.now();
    const res = http.post(
      `${API}/helper/orders`,
      JSON.stringify(body),
      { headers: HEADERS(helperToken) },
    );
    helperLatency.add(Date.now() - start);

    const ok = check(res, {
      'order created (201 or 200)': (r) => r.status === 200 || r.status === 201,
      'ada transactionId':          (r) => !!r.json('data.transactionId'),
    });

    if (ok) {
      transactionId = res.json('data.transactionId');
      orderCreated.add(1);
    } else {
      orderErrors.add(1);
    }
  });
  if (!transactionId) return;

  sleep(1); // simulasi delay customer menuju kasir

  // ── Step 4: Login Kasir ───────────────────────────────────────────────────
  group('4_cashier_login', () => {
    cashierToken = loginAsCashier(__VU);
    check(cashierToken, { 'cashier login ok': (t) => !!t });
  });
  if (!cashierToken) { orderErrors.add(1); return; }

  sleep(0.3);

  // ── Step 5: Kasir lookup transaksi ────────────────────────────────────────
  group('5_lookup', () => {
    const res = http.get(
      `${API}/payments/lookup/${transactionId}`,
      { headers: HEADERS(cashierToken) },
    );
    check(res, {
      'lookup ok':             (r) => r.status === 200,
      'status bisa diproses':  (r) => ['RESERVED','PENDING','WAITING_PAYMENT'].includes(r.json('data.status')),
    });
  });

  sleep(0.5);

  // ── Step 6: Kasir proses pembayaran ──────────────────────────────────────
  group('6_process_payment', () => {
    const body = {
      transaction_id: transactionId,
      payment_method: 'QRIS',
    };
    const start = Date.now();
    const res = http.post(
      `${API}/payments/process`,
      JSON.stringify(body),
      { headers: HEADERS(cashierToken) },
    );
    paymentLatency.add(Date.now() - start);

    const ok = check(res, {
      'payment 200':          (r) => r.status === 200,
      'status PAID':          (r) => r.json('data.status') === 'PAID',
      'payment latency < 3s': () => (Date.now() - start) < 3000,
    });

    if (ok) orderPaid.add(1);
    else orderErrors.add(1);
  });

  sleep(Math.random() * 2 + 1);
}
