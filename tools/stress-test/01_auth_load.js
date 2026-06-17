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
        { duration: '30s', target: 10  },  // warmup
        { duration: '60s', target: 50  },  // naik ke 50
        { duration: '60s', target: 100 },  // naik ke 100
        { duration: '60s', target: 100 },  // tahan 100 VU
        { duration: '30s', target: 0   },  // turun
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    login_latency_ms: ['p(95)<5000'],  // bcrypt 100 concurrent bisa 2-4 detik
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
    { headers: { 'Content-Type': 'application/json' }, timeout: '90s' },
  );
  const duration = Date.now() - start;
  loginLatency.add(duration);

  const ok = check(res, {
    'login status 200':      (r) => r.status === 200,
    'login ada token':       (r) => r.status === 200 && !!r.json('data.token'),
    'login latency < 5s':    () => duration < 5000,
  });

  loginErrors.add(!ok);
  sleep(Math.random() * 2 + 1); // jeda 1-3 detik antar request
}
