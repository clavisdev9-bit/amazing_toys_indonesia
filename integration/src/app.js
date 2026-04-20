'use strict';

require('dotenv').config();
const express = require('express');
const env = require('./config/env');
const logger = require('./config/logger');
const odoo = require('./clients/odoo.client');
const sos = require('./clients/sos.client');
const scheduler = require('./scheduler/scheduler');
const webhookRouter = require('./routes/webhook.router');
const { router: healthRouter } = require('./routes/health.router');

const app = express();

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));

app.use('/health', healthRouter);
app.use('/webhook', webhookRouter);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

function authErrDetail(err) {
  return err?.response?.data
    ? JSON.stringify(err.response.data)
    : (err?.message || String(err));
}

// Load Odoo config from shared DB (written by admin UI) and merge into env.
// DB values take priority over .env so admin form is the single source of truth.
async function loadConfigFromDB() {
  const { query } = require('./config/database');
  try {
    const result = await query(
      "SELECT value FROM system_settings WHERE key = 'integration_config'"
    );
    if (result.rows.length === 0) {
      logger.warn('No integration config in DB — using .env values. Configure via Admin → Integrasi → Integration with Odoo.');
      return;
    }

    const cfg = JSON.parse(result.rows[0].value);

    const strFields = {
      odoo_base_url:       'ODOO_BASE_URL',
      odoo_db:             'ODOO_DB',
      odoo_login:          'ODOO_LOGIN',
      odoo_password:       'ODOO_PASSWORD',
      odoo_webhook_secret: 'WEBHOOK_SECRET',
      odoo_default_tenant_id: 'DEFAULT_TENANT_ID',
    };
    const intFields = {
      odoo_walkin_partner_id:        'ODOO_WALKIN_PARTNER_ID',
      odoo_low_stock_threshold:      'LOW_STOCK_THRESHOLD',
      odoo_product_sync_interval_min:'PRODUCT_SYNC_INTERVAL_MIN',
      odoo_stock_sync_interval_min:  'STOCK_SYNC_INTERVAL_MIN',
      odoo_sweep_interval_min:       'SWEEP_INTERVAL_MIN',
      odoo_polling_interval_sec:     'POLLING_INTERVAL_SEC',
      odoo_retry_max_attempts:       'RETRY_MAX_ATTEMPTS',
      odoo_circuit_breaker_threshold:'CIRCUIT_BREAKER_THRESHOLD',
      odoo_circuit_breaker_reset_min:'CIRCUIT_BREAKER_RESET_MIN',
    };

    for (const [cfgKey, envKey] of Object.entries(strFields)) {
      if (cfg[cfgKey]) env[envKey] = cfg[cfgKey];
    }
    for (const [cfgKey, envKey] of Object.entries(intFields)) {
      if (cfg[cfgKey] !== undefined && cfg[cfgKey] !== '') {
        env[envKey] = parseInt(cfg[cfgKey], 10);
      }
    }
    if (cfg.odoo_tenant_product_mapping) {
      try { env.TENANT_PRODUCT_MAPPING = JSON.parse(cfg.odoo_tenant_product_mapping); } catch (_) {}
    }

    logger.info('Config loaded from DB', {
      ODOO_BASE_URL: env.ODOO_BASE_URL,
      ODOO_DB:       env.ODOO_DB   || '(not set)',
      ODOO_LOGIN:    env.ODOO_LOGIN || '(not set)',
    });
  } catch (err) {
    logger.warn('Failed to load config from DB — using .env values', { detail: authErrDetail(err) });
  }
}

const odooConfigured = () => !!(env.ODOO_DB && env.ODOO_LOGIN && env.ODOO_PASSWORD);

async function boot() {
  const MAX_AUTH_ATTEMPTS = 3;

  // SOS auth — required
  for (let attempt = 1; attempt <= MAX_AUTH_ATTEMPTS; attempt++) {
    try {
      await sos.authenticate();
      break;
    } catch (err) {
      logger.error(`SOS auth failed (attempt ${attempt}/${MAX_AUTH_ATTEMPTS})`, { detail: authErrDetail(err) });
      if (attempt === MAX_AUTH_ATTEMPTS) {
        logger.error('Aborting: could not authenticate with SOS after 3 attempts');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Odoo auth — skipped if not configured
  if (!odooConfigured()) {
    logger.warn('Odoo not configured (ODOO_DB/ODOO_LOGIN/ODOO_PASSWORD empty) — skipping Odoo auth. Configure via Admin → Integrasi → Integration with Odoo.');
  } else {
    for (let attempt = 1; attempt <= MAX_AUTH_ATTEMPTS; attempt++) {
      try {
        await odoo.authenticate();
        break;
      } catch (err) {
        logger.error(`Odoo auth failed (attempt ${attempt}/${MAX_AUTH_ATTEMPTS})`, { detail: authErrDetail(err) });
        if (attempt === MAX_AUTH_ATTEMPTS) {
          logger.warn('Odoo auth exhausted — service will start in degraded mode (Odoo sync disabled)');
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
  }

  try {
    if (odooConfigured()) await odoo.resolveStartupRefs();
  } catch (err) {
    logger.warn('Startup refs resolution failed (non-fatal)', { detail: authErrDetail(err) });
  }

  scheduler.start();

  app.listen(env.PORT, () => {
    logger.info(`Integration service listening on port ${env.PORT}`);
  });
}

async function main() {
  await loadConfigFromDB();
  await boot();
}

main().catch(err => {
  logger.error('Fatal boot error', { error: err.message });
  process.exit(1);
});

module.exports = app;
