'use strict';

/**
 * CR-036: WhatsApp / SMS Gateway — standalone module.
 *
 * Fire-and-forget safe: sendOrderQR never throws; it always returns
 * a status object { status: 'SENT'|'FAILED'|'SKIPPED', messageId?, error? }.
 * Kegagalan Layer 1 TIDAK menggagalkan pembuatan order — Layer 3 (QR di layar)
 * selalu menjadi fallback.
 *
 * Providers didukung: WABLAS | ZENZIVA | TWILIO | DISABLED
 * Provider dipilih dari system_settings.wa_gateway_provider.
 * Kredensial TIDAK pernah di-log.
 */

const { query } = require('../../config/database');
const logger    = require('../../config/logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _getWaSettings() {
  try {
    const result = await query(
      `SELECT key, value FROM system_settings
       WHERE key IN (
         'wa_gateway_provider', 'wa_gateway_api_key', 'wa_gateway_api_url',
         'wa_waha_session', 'wa_message_template', 'public_token_ttl_minutes', 'order_base_url'
       )`,
    );
    const map = {};
    for (const row of result.rows) {
      try { map[row.key] = JSON.parse(row.value); } catch { map[row.key] = row.value; }
    }
    return {
      provider:    (map.wa_gateway_provider || 'DISABLED').toUpperCase(),
      apiKey:      map.wa_gateway_api_key   || '',
      apiUrl:      map.wa_gateway_api_url   || '',
      wahaSession: map.wa_waha_session      || 'default',
      template:    map.wa_message_template  || _defaultTemplate(),
      ttlMinutes:  parseInt(map.public_token_ttl_minutes, 10) || 120,
      baseUrl:     (map.order_base_url      || 'http://localhost:8080').replace(/\/$/, ''),
    };
  } catch (err) {
    logger.warn('[WA] Gagal membaca settings, default DISABLED', { error: err.message });
    return { provider: 'DISABLED', apiKey: '', apiUrl: '', wahaSession: 'default', template: _defaultTemplate(), ttlMinutes: 120, baseUrl: '' };
  }
}

function _defaultTemplate() {
  return (
    'Halo! Pesanan Anda dari *{{booth_name}}* sudah dibuat.\n\n' +
    'Item: {{item_summary}}\nTotal: {{total_amount}}\n\n' +
    'Tunjukkan QR di link berikut ke kasir:\n{{order_link}}\n\n' +
    'Link berlaku {{expiry_minutes}} menit. Terima kasih!'
  );
}

function _formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

function _buildMessage(template, vars) {
  return template
    .replace('{{booth_name}}',    vars.boothName      || '')
    .replace('{{item_summary}}',  vars.itemSummary    || '')
    .replace('{{total_amount}}',  _formatRupiah(vars.totalAmount))
    .replace('{{order_link}}',    vars.orderLink      || '')
    .replace('{{expiry_minutes}}', String(vars.expiryMinutes || 120));
}

// ── Provider adapters ────────────────────────────────────────────────────────

function _toChatId(phone) {
  const digits = phone.replace(/\D/g, '');
  const e164   = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  return `${e164}@c.us`;
}

async function _callWaha(base, apiKey, session, phone, message) {
  const url = `${base.replace(/\/$/, '')}/api/sendText`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const res  = await fetch(url, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ session, chatId: _toChatId(phone), text: message }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `WAHA HTTP ${res.status}`);
  return { status: 'SENT', messageId: json.id ?? null };
}

async function _callWablas(apiUrl, apiKey, phone, message) {
  const url = (apiUrl || 'https://my.wablas.com/api/send-message').trim();
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ phone, message }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Wablas HTTP ${res.status}`);
  }
  return { status: 'SENT', messageId: json.data?.id ?? null };
}

async function _callZenziva(apiUrl, apiKey, phone, message) {
  // Zenziva credential format: "userkey:passkey"
  const [userkey = '', passkey = ''] = (apiKey || '').split(':');
  const base   = (apiUrl || 'https://console.zenziva.net/wareguler/api/sendWA/').trim();
  const params = new URLSearchParams({ userkey, passkey, nohp: phone, pesan: message });
  const res    = await fetch(`${base}?${params.toString()}`);
  const json   = await res.json().catch(() => ({}));
  if (String(json.status) !== '1') {
    throw new Error(json.message || 'Zenziva: status != 1');
  }
  return { status: 'SENT', messageId: json.data?.messageId ?? null };
}

async function _callTwilio(apiUrl, apiKey, phone, message) {
  // Twilio credential format: "accountSid:authToken"
  // apiUrl = Twilio WhatsApp sender number (e.g. +14155238886)
  const [accountSid = '', authToken = ''] = (apiKey || '').split(':');
  const senderNumber = (apiUrl || '').trim();
  const formattedTo  = phone.startsWith('+') ? phone : `+62${phone.replace(/^0/, '')}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method:  'POST',
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error_code) {
    throw new Error(json.message || `Twilio HTTP ${res.status}`);
  }
  return { status: 'SENT', messageId: json.sid ?? null };
}

async function _callGateway(settings, phone, message) {
  const { provider, apiUrl, apiKey, wahaSession } = settings;
  switch (provider) {
    case 'WAHA':    return _callWaha(apiUrl, apiKey, wahaSession, phone, message);
    case 'WABLAS':  return _callWablas(apiUrl,  apiKey, phone, message);
    case 'ZENZIVA': return _callZenziva(apiUrl, apiKey, phone, message);
    case 'TWILIO':  return _callTwilio(apiUrl,  apiKey, phone, message);
    default:        throw new Error(`Provider tidak dikenal: ${provider}`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Kirim info QR pesanan ke customer via WhatsApp/SMS.
 * Fire-and-forget safe — TIDAK pernah throw; selalu kembalikan status object.
 *
 * @param {{ phone, boothName, itemSummary, totalAmount, orderLink, expiryMinutes }} opts
 * @returns {Promise<{ status: 'SENT'|'FAILED'|'SKIPPED', messageId?: string, error?: string }>}
 */
async function sendOrderQR({ phone, boothName, itemSummary, totalAmount, orderLink, expiryMinutes }) {
  const settings = await _getWaSettings();

  if (settings.provider === 'DISABLED') {
    logger.debug('[WA] Provider DISABLED — Layer 1 dilewati');
    return { status: 'SKIPPED' };
  }

  if (!phone) {
    return { status: 'SKIPPED' };
  }

  const message = _buildMessage(settings.template, { boothName, itemSummary, totalAmount, orderLink, expiryMinutes });

  try {
    const result = await _callGateway(settings, phone, message);
    // Log TANPA nomor lengkap dan TANPA credential
    logger.info('[WA] Pesan terkirim', { phone: phone.slice(0, 5) + '***', provider: settings.provider });
    return result;
  } catch (err) {
    logger.error('[WA] Gateway error', { provider: settings.provider, error: err.message });
    return { status: 'FAILED', error: err.message };
  }
}

/**
 * Baca config WA (TTL token & base URL) untuk dipakai modul lain.
 * @returns {Promise<{ provider, ttlMinutes, baseUrl, ... }>}
 */
async function getWaConfig() {
  return _getWaSettings();
}

/**
 * Kirim test WA ke nomor admin untuk verifikasi konfigurasi.
 * @param {string} testPhone
 * @returns {Promise<{ status, messageId?, error? }>}
 */
async function sendTestMessage(testPhone) {
  const settings = await _getWaSettings();
  if (settings.provider === 'DISABLED') return { status: 'SKIPPED' };
  if (!testPhone) return { status: 'FAILED', error: 'Nomor test tidak boleh kosong.' };

  const message =
    `[TEST Amazing Toys SOS] Konfigurasi WA API (${settings.provider}) berhasil. ` +
    `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
  try {
    const result = await _callGateway(settings, testPhone, message);
    logger.info('[WA] Test pesan terkirim', { phone: testPhone.slice(0, 5) + '***', provider: settings.provider });
    return result;
  } catch (err) {
    logger.error('[WA] Test gateway error', { provider: settings.provider, error: err.message });
    return { status: 'FAILED', error: err.message };
  }
}

/**
 * Kirim kode OTP login via WhatsApp ke customer.
 * Throws jika provider DISABLED agar pemanggil bisa tangani dengan tepat.
 *
 * @param {string} phone - Nomor telepon customer (08xxx / +628xxx)
 * @param {string} otpCode - 6-digit OTP
 * @param {string} [customerName]
 * @returns {Promise<{ status: 'SENT'|'FAILED', messageId?: string, error?: string }>}
 */
async function sendOTP(phone, otpCode, customerName = 'Pelanggan') {
  const settings = await _getWaSettings();
  if (settings.provider === 'DISABLED') {
    return { status: 'FAILED', error: 'WA provider belum dikonfigurasi.' };
  }
  if (!phone) return { status: 'FAILED', error: 'Nomor telepon kosong.' };

  const message =
    `Halo *${customerName}*!\n\n` +
    `Kode verifikasi Amazing Toys Fair 2026 Anda:\n\n` +
    `🔑 *${otpCode}*\n\n` +
    `Berlaku *5 menit*. Jangan bagikan kode ini ke siapapun.\n\n` +
    `Jika Anda tidak meminta kode ini, abaikan pesan ini.`;

  try {
    const result = await _callGateway(settings, phone, message);
    logger.info('[WA-OTP] OTP terkirim', { phone: phone.slice(0, 5) + '***', provider: settings.provider });
    return result;
  } catch (err) {
    logger.error('[WA-OTP] Gagal kirim OTP', { provider: settings.provider, error: err.message });
    return { status: 'FAILED', error: err.message };
  }
}

/**
 * Kirim pesan sambutan ke customer yang baru daftar.
 * Fire-and-forget safe — tidak pernah throw.
 *
 * @param {string} phone
 * @param {string} customerName
 */
async function sendGreeting(phone, customerName = 'Tamu') {
  const settings = await _getWaSettings();
  if (settings.provider === 'DISABLED') {
    logger.debug('[WA] Greeting dilewati — provider DISABLED');
    return { status: 'SKIPPED' };
  }
  if (!phone) return { status: 'SKIPPED' };

  const message =
    `Halo *${customerName}*! 🎉\n\n` +
    `Selamat datang di *Amazing Toys Fair 2026*!\n\n` +
    `Anda sudah berhasil terdaftar. Nikmati pengalaman belanja mainan terbaik untuk buah hati Anda! 🧸\n\n` +
    `📅 *Jadwal:* 15–20 Juli 2026\n` +
    `📍 *Lokasi:* Jakarta Convention Center\n\n` +
    `Selamat berbelanja! 🛍️`;

  try {
    const result = await _callGateway(settings, phone, message);
    logger.info('[WA] Greeting terkirim', { phone: phone.slice(0, 5) + '***' });
    return result;
  } catch (err) {
    logger.error('[WA] Gagal kirim greeting', { error: err.message });
    return { status: 'FAILED', error: err.message };
  }
}

async function sendLockoutNotif(phone, lockoutMinutes = 5) {
  const settings = await _getWaSettings();
  if (settings.provider === 'DISABLED') {
    logger.debug('[WA] Lockout notif dilewati — provider DISABLED');
    return { status: 'SKIPPED' };
  }
  if (!phone) return { status: 'SKIPPED' };

  const message =
    `⚠️ *Pemberitahuan Keamanan*\n\n` +
    `Akun Anda terkunci sementara selama *${lockoutMinutes} menit* karena terlalu banyak percobaan login.\n\n` +
    `Jika ini bukan Anda, segera hubungi petugas booth Amazing Toys Fair 2026.\n\n` +
    `Setelah ${lockoutMinutes} menit, Anda dapat mencoba login kembali. 🔒`;

  try {
    const result = await _callGateway(settings, phone, message);
    logger.info('[WA] Lockout notif terkirim', { phone: phone.slice(0, 5) + '***' });
    return result;
  } catch (err) {
    logger.error('[WA] Gagal kirim lockout notif', { error: err.message });
    return { status: 'FAILED', error: err.message };
  }
}

module.exports = { sendOrderQR, getWaConfig, sendTestMessage, sendOTP, sendGreeting, sendLockoutNotif };
