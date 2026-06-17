/**
 * Test 4: SLA Notifikasi WA < 30 Detik
 *
 * Cara kerja:
 *   1. Helper buat order → catat waktu T0
 *   2. Poll endpoint /api/v1/orders/:id setiap 2 detik
 *   3. Cek field wa_delivery_status berubah dari null → 'SENT' atau 'FAILED'
 *   4. Catat waktu T1, hitung T1 - T0
 *
 * CATATAN: Test ini hanya relevan saat WA gateway AKTIF.
 *   Jika provider = DISABLED, wa_delivery_status akan 'SKIPPED' dan test skip.
 *
 * Target SLA: wa_delivery_status = SENT dalam < 30 detik sejak order dibuat.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { API, THRESHOLDS, fakePhone } from './config.js';

const waSlaLatency  = new Trend('wa_delivery_ms', true);
const waSlaPass     = new Rate('wa_sla_passed');
const waSkipped     = new Counter('wa_skipped');
const waFailed      = new Counter('wa_failed');

export const options = {
  scenarios: {
    wa_sla: {
      executor: 'constant-vus',
      vus: 20,           // 20 order dibuat bersamaan
      duration: '3m',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    wa_delivery_ms: ['p(95)<30000'],   // SLA: 95% terkirim < 30 detik
    wa_sla_passed:  ['rate>0.90'],     // minimal 90% berhasil dalam SLA
  },
};

const HEADERS = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
});

function loginHelper() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username: 'helper_stress01', password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.status === 200 ? res.json('data.token') : null;
}

function getFirstAvailableProduct(token) {
  const res = http.get(`${API}/products?limit=10`, { headers: HEADERS(token) });
  if (res.status !== 200) return null;
  const items = res.json('data.items') ?? res.json('data') ?? [];
  return items.find(p => p.stock_quantity > 0) ?? null;
}

export default function () {
  const token = loginHelper();
  if (!token) { sleep(5); return; }

  const product = getFirstAvailableProduct(token);
  if (!product) { sleep(5); return; }

  let transactionId;

  // ── Buat order ─────────────────────────────────────────────────────────────
  group('create_order', () => {
    const phone = fakePhone(__VU + 50000); // range berbeda dari test 02
    const res = http.post(
      `${API}/helper/orders`,
      JSON.stringify({
        customerPhone: phone,
        items: [{ productId: product.product_id, quantity: 1 }],
      }),
      { headers: HEADERS(token) },
    );
    if (res.status === 200 || res.status === 201) {
      transactionId = res.json('data.transactionId');
    }
  });

  if (!transactionId) { sleep(5); return; }

  const t0 = Date.now();

  // ── Poll wa_delivery_status hingga SENT/FAILED/SKIPPED ────────────────────
  group('wa_sla_poll', () => {
    const maxWait  = 35000; // 35 detik max poll (SLA 30 + 5 buffer)
    const interval = 2000;  // cek setiap 2 detik
    let   elapsed  = 0;
    let   resolved = false;

    while (elapsed < maxWait && !resolved) {
      sleep(interval / 1000);
      elapsed += interval;

      const res = http.get(
        `${API}/orders/${transactionId}`,
        { headers: HEADERS(token) },
      );

      if (res.status !== 200) continue;

      const waStatus = res.json('data.wa_delivery_status');

      if (waStatus === 'SKIPPED') {
        // WA gateway DISABLED — test ini tidak relevan
        waSkipped.add(1);
        check(waStatus, { 'WA gateway DISABLED (test skip)': () => true });
        resolved = true;

      } else if (waStatus === 'SENT') {
        const latency = Date.now() - t0;
        waSlaLatency.add(latency);
        const passed = latency < 30000;
        waSlaPass.add(passed);
        check(latency, {
          [`WA terkirim dalam SLA (${(latency/1000).toFixed(1)}s < 30s)`]: () => passed,
        });
        resolved = true;

      } else if (waStatus === 'FAILED') {
        waFailed.add(1);
        waSlaPass.add(false);
        check(waStatus, { 'WA FAILED — periksa gateway': () => false });
        resolved = true;
      }
      // null / undefined → masih menunggu, lanjut poll
    }

    if (!resolved) {
      // Timeout: WA tidak terkirim dalam 35 detik
      waSlaPass.add(false);
      check(resolved, { 'WA timeout > 35 detik — SLA BREACH': () => false });
    }
  });

  sleep(3);
}
