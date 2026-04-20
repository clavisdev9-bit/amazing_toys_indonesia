'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/**
 * Verify X-SOS-Signature header.
 * Header format: sha256=<hmac-hex>
 * HMAC is computed over the raw request body using WEBHOOK_SECRET.
 */
function verifyWebhookSignature(req, res, next) {
  if (!env.WEBHOOK_SECRET) {
    // Signature validation disabled (dev mode without secret)
    return next();
  }

  const signature = req.headers['x-sos-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-SOS-Signature header' });
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', env.WEBHOOK_SECRET)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}

module.exports = { verifyWebhookSignature };
