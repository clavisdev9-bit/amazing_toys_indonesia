'use strict';

const crypto = require('crypto');
const { query, withTransaction } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const logger                     = require('../../config/logger');

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  bca_env:          'sandbox',
  bca_base_url:     'https://sandbox.bca.co.id',
  bca_client_id:    '',
  bca_client_secret:'',
  bca_api_key:      '',
  bca_api_secret:   '',
  bca_merchant_id:  '',
  bca_terminal_id:  '',
  bca_channel_id:   '',
  bca_callback_url: '',
  bca_token_ttl:    840,
};

async function getConfigRaw() {
  const result = await query(
    "SELECT value FROM system_settings WHERE key = 'bca_qris_config'"
  );
  const stored = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : {};
  return {
    ...DEFAULT_CONFIG,
    bca_env:          process.env.BCA_ENV          || DEFAULT_CONFIG.bca_env,
    bca_base_url:     process.env.BCA_BASE_URL      || DEFAULT_CONFIG.bca_base_url,
    bca_client_id:    process.env.BCA_CLIENT_ID     || DEFAULT_CONFIG.bca_client_id,
    bca_client_secret:process.env.BCA_CLIENT_SECRET || DEFAULT_CONFIG.bca_client_secret,
    bca_api_key:      process.env.BCA_API_KEY        || DEFAULT_CONFIG.bca_api_key,
    bca_api_secret:   process.env.BCA_API_SECRET     || DEFAULT_CONFIG.bca_api_secret,
    bca_merchant_id:  process.env.BCA_MERCHANT_ID    || DEFAULT_CONFIG.bca_merchant_id,
    bca_terminal_id:  process.env.BCA_TERMINAL_ID    || DEFAULT_CONFIG.bca_terminal_id,
    bca_channel_id:   process.env.BCA_CHANNEL_ID     || DEFAULT_CONFIG.bca_channel_id,
    bca_callback_url: process.env.BCA_CALLBACK_URL   || DEFAULT_CONFIG.bca_callback_url,
    bca_token_ttl:    process.env.BCA_TOKEN_TTL ? parseInt(process.env.BCA_TOKEN_TTL, 10) : DEFAULT_CONFIG.bca_token_ttl,
    ...stored,
  };
}

const MASKED = '••••••••';
const MASKED_FIELDS = ['bca_client_secret', 'bca_api_secret'];

function maskConfig(cfg) {
  const out = { ...cfg };
  for (const f of MASKED_FIELDS) {
    out[f] = cfg[f] ? MASKED : '';
  }
  return out;
}

async function getBcaConfig() {
  return maskConfig(await getConfigRaw());
}

async function saveBcaConfig(data) {
  const current = await getConfigRaw();
  for (const f of MASKED_FIELDS) {
    if (data[f] === MASKED || data[f] === undefined) data[f] = current[f];
  }
  const updated = { ...current, ...data };
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('bca_qris_config', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(updated)]
  );
  return maskConfig(updated);
}

// ── Token cache (in-memory, per process) ─────────────────────────────────────

let _tokenCache = { token: null, expiresAt: 0 };

function _generateIso8601Wib() {
  const now  = new Date();
  const wib  = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const pad  = (n) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth()+1)}-${pad(wib.getUTCDate())}` +
         `T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}+07:00`;
}

function _rsaSign(payload, privateKeyPem) {
  return crypto.createSign('RSA-SHA256').update(payload).sign(privateKeyPem, 'base64');
}

function _snapSign(method, relativePath, accessToken, bodyStr, timestamp, apiKey) {
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex').toLowerCase();
  const stringToSign = `${method.toUpperCase()}:${relativePath}:${accessToken}:${bodyHash}:${timestamp}`;
  return crypto.createHmac('sha512', apiKey).update(stringToSign).digest('base64');
}

async function getAccessToken() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token;
  }

  const cfg = await getConfigRaw();
  if (!cfg.bca_client_id || !cfg.bca_client_secret || !cfg.bca_api_secret) {
    throw new AppError('BCA QRIS credential belum dikonfigurasi. Atur via Admin → Integrasi → BCA QRIS.', 500);
  }

  const ts   = _generateIso8601Wib();
  const cred = Buffer.from(`${cfg.bca_client_id}:${cfg.bca_client_secret}`).toString('base64');
  const sig  = _rsaSign(`${cfg.bca_client_id}|${ts}`, cfg.bca_api_secret);

  const url  = `${cfg.bca_base_url}/openapi/v1.0/access-token/b2b`;
  const body = JSON.stringify({ grantType: 'client_credentials' });

  const resp = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${cred}`,
      'X-TIMESTAMP':   ts,
      'X-CLIENT-KEY':  cfg.bca_client_id,
      'X-SIGNATURE':   sig,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    logger.error('[BCA QRIS] Token request failed', { status: resp.status, body: text });
    throw new AppError(`BCA QRIS: gagal mendapatkan access token (HTTP ${resp.status})`, 502);
  }

  const data = await resp.json();
  if (!data.accessToken) {
    logger.error('[BCA QRIS] No accessToken in response', { data });
    throw new AppError('BCA QRIS: respons token tidak valid.', 502);
  }

  const ttl = parseInt(data.expiresIn, 10) || cfg.bca_token_ttl;
  _tokenCache = { token: data.accessToken, expiresAt: now + ttl * 1000 };
  logger.info('[BCA QRIS] Access token refreshed', { ttl });
  return _tokenCache.token;
}

// ── API request helper ────────────────────────────────────────────────────────

async function _bcaRequest(relativePath, bodyObj) {
  const cfg         = await getConfigRaw();
  const accessToken = await getAccessToken();
  const ts          = _generateIso8601Wib();
  const externalId  = crypto.randomUUID();
  const bodyStr     = JSON.stringify(bodyObj);
  const sig         = _snapSign('POST', relativePath, accessToken, bodyStr, ts, cfg.bca_api_key);

  const resp = await fetch(`${cfg.bca_base_url}${relativePath}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-TIMESTAMP':   ts,
      'X-PARTNER-ID':  cfg.bca_api_key,
      'X-EXTERNAL-ID': externalId,
      'CHANNEL-ID':    cfg.bca_channel_id,
      'X-SIGNATURE':   sig,
    },
    body: bodyStr,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    logger.error('[BCA QRIS] API error', { path: relativePath, status: resp.status, data });
    throw new AppError(`BCA QRIS API error (${resp.status}): ${data.responseMessage || 'unknown'}`, 502);
  }
  return data;
}

// ── Generate QRIS ─────────────────────────────────────────────────────────────

async function generateQris({ orderId, amount, feeAmount = '0.00' }) {
  const cfg = await getConfigRaw();
  if (!cfg.bca_merchant_id || !cfg.bca_terminal_id) {
    throw new AppError('Merchant ID / Terminal ID BCA belum dikonfigurasi.', 500);
  }

  const amountStr = parseFloat(amount).toFixed(2);
  const body = {
    partnerReferenceNo: orderId,
    amount:             { value: amountStr, currency: 'IDR' },
    merchantId:         cfg.bca_merchant_id,
    terminalId:         cfg.bca_terminal_id,
    additionalInfo:     { feeAmount: { value: feeAmount, currency: 'IDR' } },
  };

  const data = await _bcaRequest('/openapi/v1.0/qr/qr-mpm-generate', body);

  if (data.responseCode !== '2000700') {
    logger.error('[BCA QRIS] Generate QR failed', { orderId, data });
    throw new AppError(`BCA QRIS: gagal generate QR — ${data.responseMessage || data.responseCode}`, 422);
  }

  await query(
    `INSERT INTO qris_transactions
       (order_id, bca_reference_no, qr_content, amount, currency, status)
     VALUES ($1, $2, $3, $4, 'IDR', 'PENDING')
     ON CONFLICT (order_id) DO UPDATE
       SET bca_reference_no = EXCLUDED.bca_reference_no,
           qr_content       = EXCLUDED.qr_content,
           status           = 'PENDING',
           updated_at       = NOW()`,
    [orderId, data.referenceNo, data.qrContent, amountStr]
  );

  logger.info('[BCA QRIS] QR generated', { orderId, referenceNo: data.referenceNo });
  return {
    orderId,
    referenceNo:        data.referenceNo,
    partnerReferenceNo: data.partnerReferenceNo,
    qrContent:          data.qrContent,
    amount:             amountStr,
  };
}

// ── Query status ──────────────────────────────────────────────────────────────

async function queryStatus(orderId) {
  const cfg = await getConfigRaw();
  const txn = await query(
    'SELECT bca_reference_no, amount FROM qris_transactions WHERE order_id = $1',
    [orderId]
  );
  if (!txn.rows[0]) throw new AppError('Transaksi QRIS tidak ditemukan.', 404);
  const { bca_reference_no: referenceNo, amount } = txn.rows[0];

  const body = {
    originalPartnerReferenceNo: orderId,
    originalReferenceNo:        referenceNo,
    serviceCode:                '47',
    amount:                     { value: parseFloat(amount).toFixed(2), currency: 'IDR' },
    merchantId:                 cfg.bca_merchant_id,
    terminalId:                 cfg.bca_terminal_id,
  };

  const data = await _bcaRequest('/openapi/v1.0/qr/qr-mpm-query', body);

  const statusCode = data.latestTransactionStatus;
  const statusMap  = { '00': 'PAID', '03': 'PENDING', '07': 'EXPIRED' };
  const newStatus  = statusMap[statusCode] || 'PENDING';

  if (newStatus === 'PAID') {
    await query(
      `UPDATE qris_transactions
       SET status = 'PAID', paid_at = $1, paid_amount = $2, updated_at = NOW()
       WHERE order_id = $3 AND status != 'PAID'`,
      [data.paidTime || new Date().toISOString(), data.paidAmount?.value || amount, orderId]
    );
  } else if (newStatus === 'EXPIRED') {
    await query(
      "UPDATE qris_transactions SET status = 'EXPIRED', updated_at = NOW() WHERE order_id = $1",
      [orderId]
    );
  }

  return { orderId, referenceNo, statusCode, status: newStatus, raw: data };
}

// ── Refund ────────────────────────────────────────────────────────────────────

async function refundTransaction({ orderId, refundAmount, reason }) {
  const txn = await query(
    'SELECT bca_reference_no, amount, status FROM qris_transactions WHERE order_id = $1',
    [orderId]
  );
  if (!txn.rows[0]) throw new AppError('Transaksi QRIS tidak ditemukan.', 404);
  const { bca_reference_no: referenceNo, status } = txn.rows[0];
  if (status !== 'PAID') throw new AppError('Refund hanya bisa dilakukan pada transaksi PAID.', 422);

  const partnerRefundNo = `REF-${orderId}-${Date.now()}`;
  const amountStr       = parseFloat(refundAmount).toFixed(2);

  const body = {
    originalPartnerReferenceNo: orderId,
    originalReferenceNo:        referenceNo,
    partnerRefundNo,
    refundAmount: { value: amountStr, currency: 'IDR' },
    reason:       reason || 'Pembatalan transaksi',
  };

  const data = await _bcaRequest('/openapi/v1.0/qr/qr-mpm-refund', body);

  await query(
    `UPDATE qris_transactions
     SET status = 'REFUNDED', refund_reference_no = $1,
         refund_amount = $2, refunded_at = NOW(), updated_at = NOW()
     WHERE order_id = $3`,
    [data.refundNo || partnerRefundNo, amountStr, orderId]
  );

  logger.info('[BCA QRIS] Refund processed', { orderId, partnerRefundNo, amountStr });
  return { orderId, partnerRefundNo, refundNo: data.refundNo, amount: amountStr };
}

// ── Webhook handler ───────────────────────────────────────────────────────────

async function handleWebhook(payload) {
  const {
    originalPartnerReferenceNo: orderId,
    originalReferenceNo:        referenceNo,
    latestTransactionStatus:    statusCode,
    amount,
    paidTime,
    additionalInfo,
  } = payload;

  logger.info('[BCA QRIS] Webhook received', { orderId, statusCode });

  if (statusCode !== '00') {
    logger.info('[BCA QRIS] Webhook: non-success status, skipping update', { orderId, statusCode });
    return;
  }

  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE qris_transactions
         SET status = 'PAID', paid_at = $1, paid_amount = $2,
             issuer_name = $3, webhook_received_at = NOW(), updated_at = NOW()
         WHERE order_id = $4`,
        [paidTime || new Date().toISOString(), amount?.value, additionalInfo?.issuerName, orderId]
      );

      await client.query(
        `UPDATE transactions
         SET status = 'PAID', payment_method = 'QRIS',
             payment_ref = $1, completed_at = NOW()
         WHERE transaction_id = $2 AND status = 'PENDING'`,
        [referenceNo, orderId]
      );
    });

    // Fire WebSocket notification if available
    try {
      const { broadcastToCustomer } = require('../../ws/websocket');
      broadcastToCustomer(orderId, {
        event:   'PAYMENT_CONFIRMED',
        orderId,
        amount:  amount?.value,
        refNo:   referenceNo,
      });
    } catch (_) { /* websocket optional */ }

    logger.info('[BCA QRIS] Webhook: order updated to PAID', { orderId });
  } catch (err) {
    logger.error('[BCA QRIS] Webhook processing error', { err: err.message, orderId });
    throw err;
  }
}

// ── DB helpers (admin) ────────────────────────────────────────────────────────

async function listQrisTransactions({ status, limit = 100, offset = 0 }) {
  const conditions = [];
  const params     = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  params.push(offset);

  const result = await query(
    `SELECT * FROM qris_transactions
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

module.exports = {
  getBcaConfig,
  saveBcaConfig,
  getAccessToken,
  generateQris,
  queryStatus,
  refundTransaction,
  handleWebhook,
  listQrisTransactions,
};
