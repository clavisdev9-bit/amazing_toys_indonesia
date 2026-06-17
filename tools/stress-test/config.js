// ── Konfigurasi Stress Test ────────────────────────────────────────────────────
// Edit bagian ini sesuai environment Anda

export const BASE_URL = 'http://localhost:3002'; // port backend (docker mapped)
export const API      = `${BASE_URL}/api/v1`;
export const WS_URL   = 'ws://localhost:3002/ws';

// Kredensial staff yang sudah ada di DB (dari seed)
export const STAFF_CREDENTIALS = {
  cashier: { username: 'kasir_stress01', password: 'test1234' },
  helper:  { username: 'helper_stress01', password: 'test1234' },
  admin:   { username: 'admin',           password: 'admin123' },
};

// Threshold SLA global (dipakai di semua test)
export const THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed:   ['rate<0.01'],       // < 1% error
  checks:            ['rate>0.99'],       // > 99% pass
};

// Nomor HP dummy untuk walk-in order (tidak kirim WA sungguhan)
export function fakePhone(vu) {
  return `08${String(vu + 10000000).slice(1)}`;
}
