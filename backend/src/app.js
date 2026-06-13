'use strict';

require('dotenv').config();

const http        = require('http');
const path        = require('path');
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const logger      = require('./config/logger');
const { errorHandler } = require('./middlewares/error.middleware');

// Routers
const authRouter         = require('./modules/auth/auth.router');
const productsRouter     = require('./modules/products/products.router');
const tenantsRouter      = require('./modules/tenants/tenants.router');
const ordersRouter       = require('./modules/orders/orders.router');
const paymentsRouter     = require('./modules/payments/payments.router');
const cashierRouter      = require('./modules/cashier/cashier.router');
const tenantOrdersRouter   = require('./modules/tenants/tenant-orders.router');
const tenantReportsRouter  = require('./modules/tenants/tenant-reports.router');
const leaderRouter       = require('./modules/leader/leader.router');
const notifRouter        = require('./modules/notifications/notifications.router');
const adminRouter        = require('./modules/admin/admin.router');
const receiptsRouter     = require('./modules/receipts/receipts.router');
const printRouter        = require('./modules/print/print.router');
const { paymentsRouter: bcaQrisPaymentsRouter, webhookRouter: bcaQrisWebhookRouter } = require('./modules/bca-qris/bca-qris.router');
const { voucherRouter, adminVoucherRouter } = require('./modules/vouchers/vouchers.routes');
const helperRouter       = require('./modules/helper/helper.router');

// WebSocket
const { setupWebSocket, wsBroadcast } = require('./ws/websocket');
const notifSvc = require('./modules/notifications/notifications.service');
notifSvc.setWsBroadcast(wsBroadcast);

// Scheduler
const { initializeScheduledJobs } = require('./modules/scheduler/JobBootstrap');
const adminSvcScheduler = require('./modules/admin/admin.service');

// Startup refs (Odoo tax ID cache)
const { resolveStartupRefs } = require('./utils/startupRefs');

// DB query helper — used for idempotent schema checks at startup
const { query: dbQuery } = require('./config/database');

// ── App setup ────────────────────────────────────────────────────────────────

const app = express();

app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || '').split(','),
  credentials: true,
}));
app.use(compression());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Global rate limiter — 1000 req / 15 min per IP
// 200 was too tight for a multi-role SPA: admin panel CRUD + maintenance
// polling + hot-reload double-mounting in dev all share the same IP bucket.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'amazing-toys-sos', timestamp: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────────────────────

const API = '/api/v1';

// Public config (logo, event name — no auth required)
app.get(`${API}/config/public`, async (_req, res, next) => {
  try {
    const adminSvc = require('./modules/admin/admin.service');
    const config   = await adminSvc.getSystemConfig();
    const taxCfg = await adminSvc.getTaxConfig().catch(() => ({}));
    res.json({ success: true, data: {
      logo_url:         config.logo_url,
      event_name:       config.event_name,
      venue:            config.venue || '',
      event_date_start: config.event_date_start || '',
      event_date_end:   config.event_date_end   || '',
      map_embed_url:    config.map_embed_url || '',
      map_image_url:    config.map_image_url || '',
      maintenance_mode: config.maintenance_mode || false,
      contact_email:       config.contact_email || '',
      ppn_rate:            parseFloat(taxCfg.ppn_rate) || 0,
      max_items_per_order: parseInt(config.max_items_per_order, 10) || 20,
      order_mode:          config.order_mode || 'HELPER_INPUT',
    } });
  } catch (err) { next(err); }
});
app.use(`${API}/auth`,          authRouter);
app.use(`${API}/products`,      productsRouter);
app.use(`${API}/tenants`,       tenantsRouter);
app.use(`${API}/orders`,        ordersRouter);
app.use(`${API}/payments`,      paymentsRouter);
app.use(`${API}/cashier`,       cashierRouter);
app.use(`${API}/helper`,        helperRouter);
app.use(`${API}/tenant-orders`, tenantOrdersRouter);
app.use(`${API}/tenant-reports`, tenantReportsRouter);
app.use(`${API}/leader`,        leaderRouter);
app.use(`${API}/notifications`, notifRouter);
app.use(`${API}/wishlist`,     require('./modules/wishlist/wishlist.router'));
app.use(`${API}/vouchers`,     voucherRouter);
app.use(`${API}/admin/vouchers`, adminVoucherRouter);
app.use(`${API}/admin`,        adminRouter);
app.use(`${API}/receipts`,     receiptsRouter);
app.use(`${API}/print`,        printRouter);
app.use(`${API}/payments/bca`, bcaQrisPaymentsRouter);
app.use(`${API}/webhook`,      bcaQrisWebhookRouter);

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler (must be last)
app.use(errorHandler);

// ── HTTP + WebSocket Server ───────────────────────────────────────────────────

const PORT   = parseInt(process.env.PORT || '3000', 10);
const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, async () => {
  logger.info(`[Server] Amazing Toys SOS API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  logger.info(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);

  // ── Idempotent schema guard (migrations 015 + 017) ───────────────────────
  // Ensures HELPER_APPROVE columns always exist regardless of whether
  // the migration SQL files were manually applied to this Docker environment.
  // Uses ADD COLUMN IF NOT EXISTS so repeated startup calls are safe.
  const helperApproveColumns = [
    // Migration 015
    `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approved_by         UUID`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS timer_locked_until  TIMESTAMPTZ`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approval_note       TEXT`,
    // Migration 017
    `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS approved_quantity   INTEGER`,
    `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT`,
  ];
  try {
    for (const sql of helperApproveColumns) await dbQuery(sql);
    logger.info('[Schema] HELPER_APPROVE columns verified (migrations 015 + 017 idempotent check done).');
  } catch (e) {
    logger.warn('[Schema] HELPER_APPROVE column check warning — some columns may be missing:', e.message);
  }

  // ── Idempotent schema guard (CR-041: OTP + trusted devices) ─────────────────
  const cr041Statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email       VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
    `CREATE TABLE IF NOT EXISTS login_otps (
       id            SERIAL      PRIMARY KEY,
       user_id       UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
       otp_hash      VARCHAR(255) NOT NULL,
       expires_at    TIMESTAMPTZ NOT NULL,
       used_at       TIMESTAMPTZ,
       attempt_count SMALLINT    NOT NULL DEFAULT 0,
       ip_address    INET,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_login_otps_user ON login_otps(user_id)`,
    `CREATE TABLE IF NOT EXISTS trusted_devices (
       id               SERIAL      PRIMARY KEY,
       user_id          UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
       device_id        UUID        NOT NULL,
       fingerprint_hash VARCHAR(255),
       device_name      VARCHAR(150),
       browser          VARCHAR(100),
       ip_address       INET,
       last_login       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       expires_at       TIMESTAMPTZ NOT NULL,
       created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE(user_id, device_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id)`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
       id         SERIAL      PRIMARY KEY,
       user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
       device_id  UUID        NOT NULL,
       token_hash VARCHAR(255) NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL,
       revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_device ON refresh_tokens(user_id, device_id)`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token       ON refresh_tokens(token_hash)`,
  ];
  try {
    for (const sql of cr041Statements) await dbQuery(sql);
    logger.info('[Schema] CR-041 OTP/device tables verified (migrations 018-021 idempotent check done).');
  } catch (e) {
    logger.warn('[Schema] CR-041 schema check warning:', e.message);
  }

  // ── Idempotent schema guard (migration 024: customer OTP + trusted devices) ──
  // customer_otps and customer_trusted_devices are used by /masuk (customer login).
  // These tables were added after the CR-041 guard was written and were never
  // included, causing "relation customer_otps does not exist" on login.
  const migration024Statements = [
    `CREATE TABLE IF NOT EXISTS customer_otps (
       id            SERIAL PRIMARY KEY,
       customer_id   UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
       otp_hash      TEXT        NOT NULL,
       expires_at    TIMESTAMPTZ NOT NULL,
       used_at       TIMESTAMPTZ,
       attempt_count INTEGER     NOT NULL DEFAULT 0,
       ip_address    INET,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_customer_otps_customer_id ON customer_otps (customer_id)`,
    `CREATE TABLE IF NOT EXISTS customer_trusted_devices (
       id           SERIAL PRIMARY KEY,
       customer_id  UUID         NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
       device_id    UUID         NOT NULL,
       device_name  VARCHAR(200),
       browser      VARCHAR(200),
       ip_address   INET,
       last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
       expires_at   TIMESTAMPTZ  NOT NULL,
       created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
       UNIQUE (customer_id, device_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_customer_trusted_devices_lookup
       ON customer_trusted_devices (customer_id, device_id)`,
  ];
  try {
    for (const sql of migration024Statements) await dbQuery(sql);
    logger.info('[Schema] Migration 024 verified — customer_otps + customer_trusted_devices ready.');
  } catch (e) {
    logger.warn('[Schema] Migration 024 schema check warning:', e.message);
  }

  // ── Idempotent schema guard (CR: item delete approval workflow) ─────────────
  const deleteRequestStatements = [
    `CREATE TABLE IF NOT EXISTS item_delete_requests (
       request_id     SERIAL        PRIMARY KEY,
       transaction_id VARCHAR(50)   REFERENCES transactions(transaction_id) ON DELETE SET NULL,
       product_id     VARCHAR(20)   NOT NULL,
       product_name   TEXT          NOT NULL,
       qty            INTEGER       NOT NULL,
       subtotal       NUMERIC(12,2) NOT NULL,
       cashier_id     UUID          REFERENCES users(user_id) ON DELETE SET NULL,
       cashier_name   TEXT          NOT NULL,
       status         TEXT          NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','APPROVED','REJECTED')),
       reason         TEXT,
       reviewed_by    UUID          REFERENCES users(user_id) ON DELETE SET NULL,
       created_at     TIMESTAMPTZ   DEFAULT NOW(),
       reviewed_at    TIMESTAMPTZ
     )`,
    // BUG-057: fix existing deployments where product_id was created as INTEGER
    `DO $$ BEGIN
       IF EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'item_delete_requests'
           AND column_name = 'product_id'
           AND data_type = 'integer'
       ) THEN
         ALTER TABLE item_delete_requests ALTER COLUMN product_id TYPE VARCHAR(20) USING product_id::text;
       END IF;
     END $$`,
    `CREATE INDEX IF NOT EXISTS idx_delete_requests_cashier ON item_delete_requests(cashier_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_delete_requests_status  ON item_delete_requests(status, created_at DESC)`,
  ];
  try {
    for (const sql of deleteRequestStatements) await dbQuery(sql);
    logger.info('[Schema] item_delete_requests table verified (idempotent check done).');
  } catch (e) {
    logger.warn('[Schema] item_delete_requests schema check warning:', e.message);
  }

  // DB pool is ready on first query; initialize scheduler after server is up.
  initializeScheduledJobs(() => adminSvcScheduler.getIntegrationConfig());

  // Cache Odoo PPN 12% tax ID — fire-and-forget, non-fatal if Odoo is unreachable at boot
  adminSvcScheduler.resolveOdooStartupRefs().catch(() => {});
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[Server] SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('[Server] HTTP server closed.');
    process.exit(0);
  });
});

module.exports = { app, server }; // exported for testing
