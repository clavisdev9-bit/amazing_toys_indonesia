'use strict';

const axios = require('axios');
const env = require('../config/env');
const logger = require('../config/logger');
const db = require('../config/database');

let _sessionId = null;
let _authPromise = null;

// Cache for startup lookups (currency ID, journal IDs)
const _cache = {};

// Credentials cache — refreshed on every authenticate() call
let _creds = null;

/**
 * Load Odoo credentials from system_settings (set via admin panel),
 * falling back to .env vars so local dev without a DB entry still works.
 */
async function loadCredentials() {
  try {
    const r = await db.query("SELECT value FROM system_settings WHERE key = 'integration_config'");
    if (r.rows[0]?.value) {
      let cfg = r.rows[0].value;
      if (typeof cfg === 'string') cfg = JSON.parse(cfg);
      if (cfg.odoo_base_url && cfg.odoo_db && cfg.odoo_login && cfg.odoo_password) {
        return {
          baseUrl:  cfg.odoo_base_url,
          db:       cfg.odoo_db,
          login:    cfg.odoo_login,
          password: cfg.odoo_password,
        };
      }
    }
  } catch (_) { /* fall through to env */ }
  return {
    baseUrl:  env.ODOO_BASE_URL,
    db:       env.ODOO_DB,
    login:    env.ODOO_LOGIN,
    password: env.ODOO_PASSWORD,
  };
}

async function authenticate() {
  _creds = await loadCredentials();
  if (!_creds.db || !_creds.login || !_creds.password) {
    throw new Error('Odoo credentials not configured. Set via Admin → Integrasi.');
  }
  logger.info('Odoo: authenticating', { baseUrl: _creds.baseUrl, db: _creds.db, login: _creds.login });
  const res = await axios.post(
    `${_creds.baseUrl}/web/session/authenticate`,
    {
      jsonrpc: '2.0',
      method: 'call',
      params: { db: _creds.db, login: _creds.login, password: _creds.password },
    },
    { timeout: 15000 }
  );
  const result = res.data?.result;
  if (!result?.uid) throw new Error('Odoo auth failed: ' + JSON.stringify(res.data?.error));
  _sessionId = res.headers['set-cookie']?.find(c => c.startsWith('session_id='))?.split(';')[0];
  if (!_sessionId) throw new Error('Odoo: session_id cookie not found');
  logger.info('Odoo: authenticated uid=' + result.uid);
  return _sessionId;
}

async function ensureAuth() {
  if (_sessionId) return _sessionId;
  if (_authPromise) return _authPromise;
  _authPromise = authenticate().finally(() => { _authPromise = null; });
  return _authPromise;
}

function invalidateSession() {
  _sessionId = null;
}

function isOdooError(data) {
  return data?.error != null;
}

async function callKw(model, method, args, kwargs = {}, retrying = false) {
  const session = await ensureAuth();
  const body = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: { model, method, args, kwargs },
  };
  const baseUrl = _creds?.baseUrl || env.ODOO_BASE_URL;
  const res = await axios.post(
    `${baseUrl}/web/dataset/call_kw`,
    body,
    {
      headers: { Cookie: session, 'Content-Type': 'application/json' },
      timeout: 20000,
    }
  );

  if (isOdooError(res.data)) {
    const err = res.data.error;
    // Session expiry
    if (!retrying && err?.data?.name?.includes('SessionExpiredException')) {
      invalidateSession();
      return callKw(model, method, args, kwargs, true);
    }
    const msg = `Odoo RPC error [${model}.${method}]: ${err?.data?.message || JSON.stringify(err)}`;
    throw Object.assign(new Error(msg), { odooError: err, fatal: isFatalOdooError(err) });
  }

  return res.data.result;
}

function isFatalOdooError(err) {
  const name = err?.data?.name || '';
  return name.includes('ValidationError') || name.includes('AccessError');
}

async function searchRead(model, domain, fields, opts = {}) {
  return callKw(model, 'search_read', [domain], { fields, limit: opts.limit || 0, order: opts.order });
}

async function create(model, values) {
  return callKw(model, 'create', [values]);
}

async function write(model, ids, values) {
  return callKw(model, 'write', [ids, values]);
}

async function execute(model, method, ids) {
  return callKw(model, method, [ids]);
}

// Resolve IDR currency id, payment journal IDs, warehouse ID, customer location,
// and custom field availability at startup.
async function resolveStartupRefs() {
  const [currencies, journals, sosFields, warehouses, custLocs] = await Promise.all([
    searchRead('res.currency', [['name', '=', 'IDR']], ['id', 'name']),
    searchRead('account.journal', [['type', 'in', ['cash', 'bank']]], ['id', 'name', 'type']),
    searchRead('ir.model.fields', [['model', '=', 'sale.order'], ['name', 'in', ['x_studio_sos_transaction_id', 'x_studio_sos_tenant_ids']]], ['name']),
    // Default warehouse: prefer code='WH', fall back to first available.
    searchRead('stock.warehouse', [['code', '=', 'WH']], ['id', 'name', 'code'], { limit: 1 }),
    // Customer virtual location — required so action_confirm can create delivery orders.
    searchRead('stock.location', [['usage', '=', 'customer'], ['active', '=', true]], ['id', 'name'], { limit: 1 }),
  ]);

  _cache.currencyIdIdr = currencies[0]?.id || null;
  _cache.journals = {};
  for (const j of journals) {
    _cache.journals[j.name.toUpperCase()] = j.id;
  }
  const fieldNames = sosFields.map(f => f.name);
  _cache.hasSosTransactionId = fieldNames.includes('x_studio_sos_transaction_id');
  _cache.hasSosTenantId = fieldNames.includes('x_studio_sos_tenant_ids');
  _cache.warehouseId = warehouses[0]?.id || null;
  _cache.customerLocationId = custLocs[0]?.id || null;
  logger.info('Odoo startup refs resolved', {
    currencyIdIdr: _cache.currencyIdIdr,
    journals: Object.keys(_cache.journals),
    hasSosFields: _cache.hasSosTransactionId,
    warehouseId: _cache.warehouseId,
    customerLocationId: _cache.customerLocationId,
  });
}

function getCache() {
  return _cache;
}

module.exports = { callKw, searchRead, create, write, execute, authenticate, invalidateSession, resolveStartupRefs, getCache };
