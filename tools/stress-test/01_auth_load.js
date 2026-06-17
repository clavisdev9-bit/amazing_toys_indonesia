/**
 * Test 1: Login Load Test
 * Simulasi 100 user login bersamaan (staff internal).
 * Target: p(95) < 1000ms, 0% error.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { API, THRESHOLDS } from './config.js';

const loginErrors  = new Rate('login_errors');
const loginLatency = new Trend('login_latency_ms', true);

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50  },  // naik ke 50 VU dalam 30 detik
        { duration: '60s', target: 100 },  // naik ke 100 VU dalam 1 menit
        { duration: '60s', target: 100 },  // tahan 100 VU selama 1 menit
        { duration: '30s', target: 0   },  // turun ke 0
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    login_latency_ms: ['p(95)<1000'],
  },
};

const CASHIER_USERS = [
  { username: 'kasir_stress01', password: 'test1234' },
  { username: 'kasir_stress02', password: 'test1234' },
  { username: 'kasir_stress03', password: 'test1234' },
  { username: 'kasir_stress04', password: 'test1234' },
  { username: 'kasir_stress05', password: 'test1234' },
  { username: 'helper_stress01', password: 'test1234' },
];

export default function () {
  const user = CASHIER_USERS[__VU % CASHIER_USERS.length];

  const start = Date.now();
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username: user.username, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const duration = Date.now() - start;
  loginLatency.add(duration);

  const ok = check(res, {
    'login status 200':      (r) => r.status === 200,
    'login ada token':       (r) => !!r.json('data.token'),
    'login latency < 1s':    () => duration < 1000,
  });

  loginErrors.add(!ok);
  sleep(Math.random() * 2 + 1); // jeda 1-3 detik antar request
}
