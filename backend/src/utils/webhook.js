'use strict';

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const url = require('url');

const INTEGRATION_WEBHOOK_BASE = process.env.INTEGRATION_WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function sign(body) {
  if (!WEBHOOK_SECRET) return null;
  return 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

/**
 * Fire-and-forget HTTP POST to the integration service webhook endpoint.
 * Never throws — all errors are silently swallowed to avoid blocking SOS flows.
 */
function fireWebhook(path, payload) {
  if (!INTEGRATION_WEBHOOK_BASE) return; // integration not configured

  const body = JSON.stringify(payload);
  const signature = sign(body);
  const fullUrl = `${INTEGRATION_WEBHOOK_BASE}${path}`;

  try {
    const parsed = url.parse(fullUrl);
    const lib = parsed.protocol === 'https:' ? https : http;

    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (signature) headers['X-SOS-Signature'] = signature;

    const req = lib.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.path, method: 'POST', headers, timeout: 5000 },
      (res) => { res.resume(); } // drain response
    );
    req.on('error', () => {}); // swallow
    req.on('timeout', () => { req.destroy(); });
    req.write(body);
    req.end();
  } catch (_) {
    // Never propagate webhook errors to the caller
  }
}

module.exports = { fireWebhook };
