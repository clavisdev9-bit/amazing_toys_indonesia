'use strict';

/**
 * WebSocket server for real-time updates:
 *   - Order status changes (PENDING → PAID)
 *   - Tenant notifications
 *   - Pickup status updates (READY → DONE)
 *
 * Clients authenticate by sending: { type: 'AUTH', token: '<jwt>' }
 * Server sends events: { event: '...', payload: { ... } }
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/** Map: tenantId → Set<WebSocket> */
const tenantClients = new Map();
/** Map: customerId → Set<WebSocket> */
const customerClients = new Map();

/** Module-level WSS reference so broadcastToAll can access it */
let wssInstance = null;

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wssInstance = wss;

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'AUTH') {
        try {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
          ws.authPayload = payload;

          if (payload.role === 'CUSTOMER') {
            if (!customerClients.has(payload.customerId)) customerClients.set(payload.customerId, new Set());
            customerClients.get(payload.customerId).add(ws);
          } else if (payload.role === 'TENANT' && payload.tenantId) {
            if (!tenantClients.has(payload.tenantId)) tenantClients.set(payload.tenantId, new Set());
            tenantClients.get(payload.tenantId).add(ws);
          }

          ws.send(JSON.stringify({ event: 'AUTH_OK', role: payload.role }));
        } catch {
          ws.send(JSON.stringify({ event: 'AUTH_ERROR', message: 'Invalid token.' }));
          ws.close();
        }
      }
    });

    ws.on('close', () => {
      if (!ws.authPayload) return;
      const { role, customerId, tenantId } = ws.authPayload;
      if (role === 'CUSTOMER' && customerClients.has(customerId)) {
        customerClients.get(customerId).delete(ws);
      }
      if (role === 'TENANT' && tenantClients.has(tenantId)) {
        tenantClients.get(tenantId).delete(ws);
      }
    });
  });

  // Heartbeat — close dead connections every 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('[WebSocket] Server ready on /ws');
  return wss;
}

/**
 * Broadcast a message to all connected clients of a specific tenant.
 */
function broadcastToTenant(tenantId, payload) {
  const clients = tenantClients.get(tenantId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

/**
 * Broadcast a message to a specific customer.
 */
function broadcastToCustomer(customerId, payload) {
  const clients = customerClients.get(customerId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

/**
 * Global broadcast function called by notifications.service.
 * Routes by tenantId if present; otherwise no-op.
 */
function wsBroadcast({ event, tenantId, transactionId, message }) {
  if (tenantId) {
    broadcastToTenant(tenantId, { event, transactionId, message });
  }
}

/**
 * Broadcast a message to ALL connected authenticated clients.
 * Used for system-wide events like maintenance mode changes.
 */
function broadcastToAll(payload) {
  if (!wssInstance) return;
  const msg = JSON.stringify(payload);
  wssInstance.clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

module.exports = { setupWebSocket, broadcastToTenant, broadcastToCustomer, wsBroadcast, broadcastToAll };
