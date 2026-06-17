/**
 * Test 2: Full Order Flow — 100 Virtual Users bersamaan
 * Setiap VU mensimulasikan helper membuat order walk-in,
 * kemudian cashier memproses pembayaran.
 *
 * Alur: (pre-login di setup) → Buat Order → Lookup → Bayar
 * Target: ≥50 order dibayar, p(95) helper_create < 3s, p(95) payment < 3s.
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
    orders_paid:        ['count>50'],
    order_errors:       ['rate<0.05'],
    helper_create_ms:   ['p(95)<3000'],
    payment_process_ms: ['p(95)<3000'],
  },
};

const HEADERS = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
});

// 5 high-stock products (>3500 units each) — VUs round-robin to spread DB lock contention
const STRESS_PRODUCTS = [
  'P26603-T001', // SAMSAM LUCKY CAT BLIND BOX 1.0   — 4636 units
  'P26604-T001', // SAMSAM LUCKY CAT BLIND BOX 2.0   — 4696 units
  'P26605-T001', // SAMSAM DHARMA TUMBLER BLIND BOX  — 3964 units
  'P26606-T001', // SAMSAM LUCKY CAT LUCKY BLIND BOX — 3731 units
  'P26612-T001', // SAMSAM ADVENTURER                — 3850 units
];

function doLogin(username, password) {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    console.error(`Login failed for ${username}: ${res.status} ${res.body}`);
    return null;
  }
  return res.json('data.token');
}

// setup() runs once before all VUs start — tokens are shared across VUs
export function setup() {
  const helperToken = doLogin('helper_stress01', 'test1234');
  const cashierTokens = [
    doLogin('kasir_stress01', 'test1234'),
    doLogin('kasir_stress02', 'test1234'),
    doLogin('kasir_stress03', 'test1234'),
    doLogin('kasir_stress04', 'test1234'),
    doLogin('kasir_stress05', 'test1234'),
  ];
  if (!helperToken) throw new Error('setup: helper login failed');
  return { helperToken, cashierTokens };
}

export default function (data) {
  const helperToken  = data.helperToken;
  const cashierToken = data.cashierTokens[__VU % data.cashierTokens.length];
  if (!helperToken || !cashierToken) { orderErrors.add(1); return; }

  let transactionId;

  // ── Step 1: Buat order ────────────────────────────────────────────────────
  group('1_create_order', () => {
    const productId = STRESS_PRODUCTS[__VU % STRESS_PRODUCTS.length];
    const body = {
      customerPhone: fakePhone(__VU),
      items: [{ product_id: productId, qty: 1 }],
    };
    const start = Date.now();
    const res = http.post(
      `${API}/helper/orders`,
      JSON.stringify(body),
      { headers: HEADERS(helperToken) },
    );
    helperLatency.add(Date.now() - start);

    const ok = check(res, {
      'order created (201/200)': (r) => r.status === 200 || r.status === 201,
      'ada transactionId':       (r) => !!(r.json('data') && r.json('data.transactionId')),
    });

    if (ok) {
      transactionId = res.json('data.transactionId');
      orderCreated.add(1);
    } else {
      orderErrors.add(1);
      console.error(`create_order failed: ${res.status} ${res.body.substring(0, 200)}`);
    }
  });
  if (!transactionId) return;

  sleep(0.5);

  // ── Step 2: Lookup ────────────────────────────────────────────────────────
  group('2_lookup', () => {
    const res = http.get(
      `${API}/payments/lookup/${transactionId}`,
      { headers: HEADERS(cashierToken) },
    );
    check(res, {
      'lookup ok':            (r) => r.status === 200,
      'status bisa diproses': (r) => ['RESERVED','PENDING','WAITING_PAYMENT'].includes(r.json('data.status')),
    });
  });

  sleep(0.3);

  // ── Step 3: Proses pembayaran ─────────────────────────────────────────────
  group('3_process_payment', () => {
    const start = Date.now();
    const res = http.post(
      `${API}/payments/process`,
      JSON.stringify({ transaction_id: transactionId, payment_method: 'QRIS' }),
      { headers: HEADERS(cashierToken) },
    );
    paymentLatency.add(Date.now() - start);

    const ok = check(res, {
      'payment 200':          (r) => r.status === 200,
      'status PAID':          (r) => r.json('data.status') === 'PAID',
      'payment latency < 3s': () => (Date.now() - start) < 3000,
    });

    if (ok) orderPaid.add(1);
    else {
      orderErrors.add(1);
      console.error(`payment failed: ${res.status} ${res.body.substring(0, 200)}`);
    }
  });

  sleep(Math.random() * 1 + 0.5);
}
