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

// WebSocket
const { setupWebSocket, wsBroadcast } = require('./ws/websocket');
const notifSvc = require('./modules/notifications/notifications.service');
notifSvc.setWsBroadcast(wsBroadcast);

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
    res.json({ success: true, data: {
      logo_url:         config.logo_url,
      event_name:       config.event_name,
      map_embed_url:    config.map_embed_url || '',
      map_image_url:    config.map_image_url || '',
      maintenance_mode: config.maintenance_mode || false,
    } });
  } catch (err) { next(err); }
});
app.use(`${API}/auth`,          authRouter);
app.use(`${API}/products`,      productsRouter);
app.use(`${API}/tenants`,       tenantsRouter);
app.use(`${API}/orders`,        ordersRouter);
app.use(`${API}/payments`,      paymentsRouter);
app.use(`${API}/cashier`,       cashierRouter);
app.use(`${API}/tenant-orders`, tenantOrdersRouter);
app.use(`${API}/tenant-reports`, tenantReportsRouter);
app.use(`${API}/leader`,        leaderRouter);
app.use(`${API}/notifications`, notifRouter);
app.use(`${API}/admin`,        adminRouter);
app.use(`${API}/receipts`,     receiptsRouter);

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

server.listen(PORT, () => {
  logger.info(`[Server] Amazing Toys SOS API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  logger.info(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
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
