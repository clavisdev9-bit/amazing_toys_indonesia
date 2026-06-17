/**
 * Test 3: WebSocket Load Test — 100 koneksi bersamaan
 * Setiap VU membuka koneksi WS, subscribe ke channel, dan hold selama 2 menit.
 * Target: semua koneksi berhasil, tidak ada disconnect paksa dari server.
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { API, WS_URL, THRESHOLDS } from './config.js';
import http from 'k6/http';

const wsConnected    = new Counter('ws_connections_ok');
const wsErrors       = new Rate('ws_errors');
const wsConnectTime  = new Trend('ws_connect_ms', true);
const wsMessagesRcvd = new Counter('ws_messages_received');

export const options = {
  scenarios: {
    ws_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 30  },
        { duration: '30s', target: 100 },
        { duration: '90s', target: 100 },  // tahan 100 koneksi 90 detik
        { duration: '15s', target: 0   },
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    ws_errors:      ['rate<0.02'],         // < 2% koneksi gagal
    ws_connect_ms:  ['p(95)<500'],         // koneksi < 500ms
    ws_connections_ok: ['count>80'],       // minimal 80 koneksi berhasil
  },
};

function getToken() {
  const users = ['kasir_stress01','kasir_stress02','kasir_stress03','kasir_stress04','kasir_stress05','helper_stress01'];
  const user = users[__VU % users.length];
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ username: user, password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.status === 200 ? res.json('data.token') : null;
}

export default function () {
  const token = getToken();
  if (!token) { wsErrors.add(1); return; }

  const start = Date.now();
  let connected = false;
  let msgCount  = 0;
  let errors    = 0;

  const wsUrlWithToken = `${WS_URL}?token=${token}`;

  const response = ws.connect(wsUrlWithToken, {}, (socket) => {
    socket.on('open', () => {
      wsConnectTime.add(Date.now() - start);
      connected = true;
      wsConnected.add(1);

      // Kirim ping setiap 20 detik untuk keep-alive
      socket.setInterval(() => {
        try { socket.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
      }, 20000);
    });

    socket.on('message', (msg) => {
      msgCount++;
      wsMessagesRcvd.add(1);
      try {
        const data = JSON.parse(msg);
        // Validasi event yang diterima punya struktur dasar
        check(data, {
          'ws message punya event atau type': (d) => !!(d.event || d.type),
        });
      } catch (_) {}
    });

    socket.on('error', (e) => {
      errors++;
      wsErrors.add(1);
    });

    // Hold koneksi selama 2 menit (120 detik) untuk simulasi user aktif
    socket.setTimeout(() => {
      socket.close();
    }, 120000);
  });

  check(response, {
    'ws connected':     () => connected,
    'ws no errors':     () => errors === 0,
    'ws status 101':    (r) => r && r.status === 101,
  });

  if (!connected) wsErrors.add(1);
}
