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
const customerRouter     = require('./modules/customer/customer.router');
const preorderRouter     = require('./modules/preorder/preorder.router');

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

// Global rate limiter — per IP per 15 menit
// Dinaikkan ke 50000: stress test 100 VU × 4 menit ≈ 23k req dari 1 IP (Docker NAT).
// Di pameran semua staff mungkin share 1 IP (WiFi booth), jadi limit harus cukup longgar.
// Brute-force auth dilindungi oleh customer_login_attempt.service secara terpisah.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000,
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
app.use(`${API}/customer`,      customerRouter);
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
app.use(`${API}/preorder`,     preorderRouter);
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

// Runs a list of idempotent DDL statements at startup; logs result; never throws.
async function runSchemaGuard(label, statements) {
  try {
    for (const sql of statements) await dbQuery(sql);
    logger.info(`[Schema] ${label} ready.`);
  } catch (e) {
    logger.warn(`[Schema] ${label} warning:`, e.message);
  }
}

server.listen(PORT, async () => {
  logger.info(`[Server] Amazing Toys SOS API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  logger.info(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);

  // ── Idempotent schema guards (ADD/CREATE IF NOT EXISTS — safe to re-run) ──────
  await runSchemaGuard('Migrations 015+017 — HELPER_APPROVE columns', [
    `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approved_by         UUID`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS timer_locked_until  TIMESTAMPTZ`,
    `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approval_note       TEXT`,
    `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS approved_quantity   INTEGER`,
    `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT`,
  ]);

  await runSchemaGuard('Migrations 018-021 — CR-041 OTP/device tables', [
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
  ]);

  await runSchemaGuard('Migration 024 — customer OTP/trusted devices', [
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
  ]);

  await runSchemaGuard('Item delete approval workflow', [
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
  ]);

  await runSchemaGuard('Migration 025 — wa_expiry_notif_sent_at', [
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wa_expiry_notif_sent_at TIMESTAMPTZ DEFAULT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_wa_expiry_notif
       ON transactions (expires_at)
       WHERE wa_expiry_notif_sent_at IS NULL
         AND status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')`,
  ]);

  await runSchemaGuard('Migration 029 — CR-05X pre-order', [
    // txn_status_enum — ADD VALUE IF NOT EXISTS is safe to re-run (PostgreSQL ≥ 9.1)
    `ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'AWAITING_SHIPMENT'`,
    `ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'SHIPPED'`,
    `ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'ARRIVED'`,
    `ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'PREORDER_HANDOVER'`,
    // actor_role_enum — ADMIN melakukan ship/arrived; audit_log harus menerima role ini
    `ALTER TYPE actor_role_enum ADD VALUE IF NOT EXISTS 'ADMIN'`,
    // products
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder   BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_note TEXT`,
    // transactions — order type & shipping
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_type        VARCHAR(20) DEFAULT 'REGULAR'`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_name     VARCHAR(100)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_phone    VARCHAR(20)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_address  TEXT`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_city     VARCHAR(100)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_province VARCHAR(100)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS courier           VARCHAR(50)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_number   VARCHAR(100)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipped_at        TIMESTAMPTZ`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS arrived_at        TIMESTAMPTZ`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS handed_over_at    TIMESTAMPTZ`,
    // index
    `CREATE INDEX IF NOT EXISTS idx_transactions_order_type
       ON transactions (order_type, status)
       WHERE order_type = 'PREORDER'`,
  ]);

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
