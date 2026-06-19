'use strict';

// Admin-triggered sync routes — called by the SOS backend, never by the browser.
// Protected by the shared WEBHOOK_SECRET so only trusted callers can invoke.

const express = require('express');
const env     = require('../config/env');
const logger  = require('../config/logger');
const odoo    = require('../clients/odoo.client');
const { pushProductsToOdoo } = require('../services/push.product.sync');

const router = express.Router();

function requireSecret(req, res, next) {
  const secret =
    req.headers['x-webhook-secret'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!secret || secret !== env.WEBHOOK_SECRET) {
    logger.warn('sync.router: unauthorized request', { ip: req.ip, path: req.path });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

/**
 * POST /sync/push/products
 * Triggered by the admin "Sync to Odoo" button (proxied through the SOS backend).
 * Body: { force?: boolean }
 */
router.post('/push/products', requireSecret, async (req, res) => {
  const force = req.body?.force === true;
  logger.info('sync.router: push/products requested', { force });

  try {
    const result = await pushProductsToOdoo(force);
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, message: err.message });
    }
    logger.error('sync.router: push/products failed', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: err.message || 'Product push to Odoo failed',
    });
  }
});

/**
 * POST /sync/reload-config
 * Called by the SOS backend whenever admin saves new Odoo credentials.
 * Invalidates the cached Odoo session so the next Odoo call re-authenticates
 * with fresh credentials read directly from DB (via odoo.client loadCredentials).
 */
router.post('/reload-config', requireSecret, (req, res) => {
  odoo.invalidateSession();
  logger.info('sync.router: Odoo session invalidated — will re-auth with fresh DB config on next call');
  return res.json({ success: true, message: 'Config reload triggered. Odoo will re-authenticate on next call.' });
});

module.exports = router;
