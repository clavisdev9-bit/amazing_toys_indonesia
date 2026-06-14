'use strict';

/**
 * TxnNotifJob — kirim WA notifikasi ke customer saat pesanan hampir kadaluarsa.
 *
 * Logika:
 *  1. Baca `order_notif_limit_minutes` dari system-config.json (default 5).
 *  2. Cari transaksi RESERVED/WAITING_PAYMENT yang:
 *       - expires_at antara NOW() dan NOW() + notif_minutes
 *       - wa_expiry_notif_sent_at IS NULL (belum pernah dikirim)
 *       - punya nomor telepon customer
 *  3. Kirim WA, lalu tandai wa_expiry_notif_sent_at = NOW().
 */

const fs   = require('fs');
const path = require('path');
const { query } = require('../../../config/database');
const logger    = require('../../../config/logger');

const JOB_NAME  = 'txn.expiry.notif';
const DATA_FILE = path.join(__dirname, '../../../../data/system-config.json');

function _readNotifMinutes() {
  try {
    const cfg = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const v   = parseInt(cfg.order_notif_limit_minutes, 10);
    if (Number.isFinite(v) && v > 0) return v;
  } catch { /* fallback */ }
  return 5;
}

function _formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

async function _getGatewaySettings() {
  const result = await query(
    `SELECT key, value FROM system_settings
     WHERE key IN ('wa_gateway_provider','wa_gateway_api_key','wa_gateway_api_url','wa_waha_session')`,
  );
  const map = {};
  for (const r of result.rows) {
    try { map[r.key] = JSON.parse(r.value); } catch { map[r.key] = r.value; }
  }
  return {
    provider:    (map.wa_gateway_provider || 'DISABLED').toUpperCase(),
    apiKey:      map.wa_gateway_api_key   || '',
    apiUrl:      map.wa_gateway_api_url   || '',
    wahaSession: map.wa_waha_session      || 'default',
  };
}

async function _sendMessage(settings, phone, message) {
  const { provider, apiKey, apiUrl, wahaSession } = settings;
  const digits = phone.replace(/\D/g, '');
  const e164   = digits.startsWith('0') ? '62' + digits.slice(1) : digits;

  if (provider === 'WAHA') {
    const url = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-Api-Key'] = apiKey;
    const res = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ session: wahaSession, chatId: `${e164}@c.us`, text: message }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || `WAHA HTTP ${res.status}`); }

  } else if (provider === 'WABLAS') {
    const url = (apiUrl || 'https://my.wablas.com/api/send-message').trim();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.status === false) throw new Error(j.message || `Wablas HTTP ${res.status}`);

  } else if (provider === 'ZENZIVA') {
    const [userkey = '', passkey = ''] = (apiKey || '').split(':');
    const base   = (apiUrl || 'https://console.zenziva.net/wareguler/api/sendWA/').trim();
    const params = new URLSearchParams({ userkey, passkey, nohp: phone, pesan: message });
    const res    = await fetch(`${base}?${params.toString()}`);
    const j      = await res.json().catch(() => ({}));
    if (String(j.status) !== '1') throw new Error(j.message || 'Zenziva: status != 1');

  } else if (provider === 'TWILIO') {
    const [accountSid = '', authToken = ''] = (apiKey || '').split(':');
    const senderNumber = (apiUrl || '').trim();
    const formattedTo  = phone.startsWith('+') ? phone : `+62${phone.replace(/^0/, '')}`;
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${senderNumber}`,
          To:   `whatsapp:${formattedTo}`,
          Body: message,
        }),
      },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error_code) throw new Error(j.message || `Twilio HTTP ${res.status}`);

  } else {
    throw new Error(`Provider tidak dikenal atau DISABLED: ${provider}`);
  }
}

let _runCount = 0;

async function execute() {
  _runCount++;
  const notifMinutes = _readNotifMinutes();

  let settings;
  try {
    settings = await _getGatewaySettings();
  } catch (err) {
    logger.error(`[${JOB_NAME}] gagal baca gateway settings`, { error: err.message });
    return { notified: 0 };
  }

  if (settings.provider === 'DISABLED') {
    // warn setiap 10 run (10 menit) agar admin tahu WA provider belum dikonfigurasi
    if (_runCount % 10 === 1) {
      logger.warn(`[${JOB_NAME}] provider DISABLED — notif WA tidak terkirim. Konfigurasi WA Gateway di admin.`);
    }
    return { notified: 0 };
  }

  let rows = [];
  try {
    const result = await query(`
      SELECT
        t.transaction_id,
        t.expires_at,
        t.total_amount,
        COALESCE(t.customer_phone, c.phone_number) AS phone,
        ten.tenant_name AS booth_name
      FROM transactions t
      LEFT JOIN customers c  ON c.customer_id = t.customer_id
      LEFT JOIN tenants   ten ON ten.tenant_id = (
        SELECT ti2.tenant_id FROM transaction_items ti2
        WHERE ti2.transaction_id = t.transaction_id
        LIMIT 1
      )
      WHERE t.status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')
        AND t.expires_at IS NOT NULL
        AND t.expires_at > NOW()
        AND t.expires_at <= NOW() + ($1 || ' minutes')::INTERVAL
        AND t.wa_expiry_notif_sent_at IS NULL
    `, [String(notifMinutes)]);
    rows = result.rows;
  } catch (err) {
    logger.error(`[${JOB_NAME}] query failed`, { error: err.message });
    return { notified: 0 };
  }

  if (rows.length === 0) {
    // heartbeat setiap 10 run (10 menit) untuk konfirmasi job aktif
    if (_runCount % 10 === 1) {
      logger.info(`[${JOB_NAME}] aktif — tidak ada transaksi dalam window ${notifMinutes}m (run #${_runCount})`);
    }
    return { notified: 0 };
  }

  logger.info(`[${JOB_NAME}] ${rows.length} transaksi akan dinotifikasi`, { notifMinutes });

  let notified = 0;
  for (const row of rows) {
    if (!row.phone) continue;

    const minsLeft = Math.max(1, Math.round((new Date(row.expires_at) - Date.now()) / 60000));
    const message  =
      `⏳ *Pengingat Pesanan Amazing Toys Fair 2026*\n\n` +
      `Halo! Pesanan Anda *${row.transaction_id}* di *${row.booth_name || 'Amazing Toys'}* ` +
      `akan kadaluarsa dalam *${minsLeft} menit*.\n\n` +
      `Segera tunjukkan QR pesanan Anda ke kasir sebelum waktu habis.\n\n` +
      `Total: *${_formatRupiah(row.total_amount)}*`;

    try {
      await _sendMessage(settings, row.phone, message);
      await query(
        `UPDATE transactions SET wa_expiry_notif_sent_at = NOW() WHERE transaction_id = $1`,
        [row.transaction_id],
      );
      notified++;
      logger.info(`[${JOB_NAME}] notif terkirim`, {
        txn:      row.transaction_id,
        phone:    row.phone.slice(0, 5) + '***',
        provider: settings.provider,
      });
    } catch (err) {
      logger.error(`[${JOB_NAME}] gagal kirim notif`, {
        txn:   row.transaction_id,
        error: err.message,
      });
    }
  }

  return { notified };
}

module.exports = { JOB_NAME, execute };
