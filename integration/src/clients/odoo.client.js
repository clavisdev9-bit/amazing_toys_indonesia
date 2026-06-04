'use strict';

const axios = require('axios');
const env = require('../config/env');
const logger = require('../config/logger');
const db = require('../config/database');

let _sessionId = null;
let _authPromise = null;
let _uid = null;

// Cache for startup lookups (currency ID, journal IDs)
const _cache = {};

// Credentials cache — refreshed on every authenticate() call
let _creds = null;

/**
 * Load Odoo credentials from system_settings (set via admin panel),
 * falling back to .env vars so local dev without a DB entry still works.
 * Also loads company_id for multi-company context injection.
 */
async function loadCredentials() {
  try {
    const r = await db.query("SELECT value FROM system_settings WHERE key = 'integration_config'");
    if (r.rows[0]?.value) {
      let cfg = r.rows[0].value;
      if (typeof cfg === 'string') cfg = JSON.parse(cfg);
      if (cfg.odoo_base_url && cfg.odoo_db && cfg.odoo_login && cfg.odoo_password) {
        return {
          baseUrl:   cfg.odoo_base_url,
          db:        cfg.odoo_db,
          login:     cfg.odoo_login,
          password:  cfg.odoo_password,
          companyId: cfg.odoo_company_id ? Number(cfg.odoo_company_id) : null,
        };
      }
    }
  } catch (_) { /* fall through to env */ }
  return {
    baseUrl:   env.ODOO_BASE_URL,
    db:        env.ODOO_DB,
    login:     env.ODOO_LOGIN,
    password:  env.ODOO_PASSWORD,
    companyId: null,
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
  _uid = result.uid;

  // Validate the configured company is accessible to this user.
  // Odoo auth returns user_companies.allowed_companies as { "id": {...}, ... }.
  // If the stored odoo_company_id is not in that set, throw immediately — silently
  // falling back to a different company would cause every order, product, and stock
  // record to land in the wrong company.
  const allowedCompanies = result.user_companies?.allowed_companies || {};
  const allowedIds = Object.keys(allowedCompanies).map(Number);
  if (_creds.companyId && allowedIds.length > 0 && !allowedIds.includes(_creds.companyId)) {
    const msg =
      `Odoo: configured company_id=${_creds.companyId} is NOT accessible to uid=${result.uid} ` +
      `(allowed: [${allowedIds.join(', ')}]). ` +
      'In Odoo, go to Settings → Users → Amazing Toys → Companies and enable the target company. ' +
      'Then fix odoo_company_id in Admin → Integrasi → Integration with Odoo.';
    logger.error(msg);
    throw new Error(msg);
  }

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
  _uid = null;
}

function isOdooError(data) {
  return data?.error != null;
}

function isRateLimitError(err) {
  if (!err) return false;
  if (err?.code === 429 || err?.status === 429) return true;
  const msg = err?.data?.message || err?.message || '';
  return /too many requests/i.test(msg);
}

const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * _state: { sessionRetried?: boolean, rlAttempts?: number }
 * Tracks per-call retry context to avoid mixing session-retry and rate-limit-retry.
 */
async function callKw(model, method, args, kwargs = {}, _state = {}) {
  const session = await ensureAuth();

  // Inject company_id into every RPC context so all records are scoped to the
  // correct company in a multi-company Odoo instance.
  const companyId = _creds?.companyId;
  if (companyId) {
    kwargs = {
      ...kwargs,
      context: {
        lang: 'en_US',
        tz: 'Asia/Jakarta',
        ...(kwargs.context || {}),
        uid: _uid,                          // always current uid (post re-auth)
        allowed_company_ids: [companyId],
        company_id: companyId,
      },
    };
  }

  const body = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: { model, method, args, kwargs },
  };
  const baseUrl = _creds?.baseUrl || env.ODOO_BASE_URL;

  let res;
  try {
    res = await axios.post(
      `${baseUrl}/web/dataset/call_kw`,
      body,
      {
        headers: { Cookie: session, 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );
  } catch (axiosErr) {
    // Odoo Online can return HTTP 429 — axios throws for non-2xx
    if (axiosErr.response?.status === 429) {
      const rlAttempts = _state.rlAttempts || 0;
      if (rlAttempts < 3) {
        const waitMs = 2000 * Math.pow(2, rlAttempts);
        logger.warn(`Odoo HTTP 429 [${model}.${method}] — waiting ${waitMs}ms (attempt ${rlAttempts + 1}/3)`);
        await _sleep(waitMs);
        return callKw(model, method, args, kwargs, { ..._state, rlAttempts: rlAttempts + 1 });
      }
    }
    throw axiosErr;
  }

  if (isOdooError(res.data)) {
    const err = res.data.error;

    // Session expiry — re-auth and retry once
    if (!_state.sessionRetried && err?.data?.name?.includes('SessionExpiredException')) {
      invalidateSession();
      return callKw(model, method, args, kwargs, { ..._state, sessionRetried: true });
    }

    // Rate limit in JSON-RPC body — wait and retry with exponential backoff
    if (isRateLimitError(err)) {
      const rlAttempts = _state.rlAttempts || 0;
      if (rlAttempts < 3) {
        const waitMs = 2000 * Math.pow(2, rlAttempts);
        logger.warn(`Odoo rate limit [${model}.${method}] — waiting ${waitMs}ms (attempt ${rlAttempts + 1}/3)`);
        await _sleep(waitMs);
        return callKw(model, method, args, kwargs, { ..._state, rlAttempts: rlAttempts + 1 });
      }
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
  const companyId = _creds?.companyId;

  // Build company-scoped domains for warehouse and journal lookups so that in a
  // multi-company Odoo instance we always pick resources that belong to the
  // configured company rather than the first record found across all companies.
  const warehouseDomain = companyId
    ? [['company_id', '=', companyId]]
    : [['code', '=', 'WH']];

  const journalDomain = companyId
    ? [['type', 'in', ['cash', 'bank']], ['company_id', '=', companyId]]
    : [['type', 'in', ['cash', 'bank']]];

  // Partners/Customers is a global location (company_id=False) shared across companies.
  // Filtering by company_id would exclude it and leave customerLocationId=null, causing
  // property_stock_customer to never be set and action_confirm to fail with "in False".
  const custLocDomain = [['usage', '=', 'customer'], ['active', '=', true], ['company_id', '=', false]];

  // Sequential calls with small gaps to avoid bursting Odoo Online's rate limit.
  // (5 parallel requests at startup are enough to trigger HTTP 429 on trial instances.)
  const currencies  = await searchRead('res.currency', [['name', '=', 'IDR']], ['id', 'name']);
  await _sleep(150);
  const journals    = await searchRead('account.journal', journalDomain, ['id', 'name', 'type']);
  await _sleep(150);
  const sosFields   = await searchRead('ir.model.fields', [['model', '=', 'sale.order'], ['name', 'in', ['x_studio_sos_transaction_id', 'x_studio_sos_tenant_ids']]], ['name', 'ttype', 'relation']);
  await _sleep(150);
  const warehouses  = await searchRead('stock.warehouse', warehouseDomain, ['id', 'name', 'code'], { limit: 1 });
  await _sleep(150);
  const custLocs    = await searchRead('stock.location', custLocDomain, ['id', 'name'], { limit: 1 });
  await _sleep(150);
  // Prefer a "Buy" route for replenishment; fall back to any product-selectable route.
  // Used by order.push.js when action_confirm fails with a route error.
  const buyRoutes   = await searchRead('stock.route', [['name', 'ilike', 'Buy'], ['product_selectable', '=', true]], ['id', 'name'], { limit: 1 });
  const fallbackRoutes = buyRoutes.length > 0
    ? buyRoutes
    : await searchRead('stock.route', [['product_selectable', '=', true]], ['id', 'name'], { limit: 1 });

  _cache.currencyIdIdr = currencies[0]?.id || null;
  _cache.journals = {};
  for (const j of journals) {
    _cache.journals[j.name.toUpperCase()] = j.id;
  }
  const txnField      = sosFields.find(f => f.name === 'x_studio_sos_transaction_id');
  const tenantField   = sosFields.find(f => f.name === 'x_studio_sos_tenant_ids');
  const voucherField  = sosFields.find(f => f.name === 'x_voucher_code');
  _cache.hasSosTransactionId    = !!txnField;
  _cache.hasSosTenantId         = !!tenantField;
  _cache.tenantIdFieldType      = tenantField?.ttype     || null;
  _cache.tenantIdFieldRelation  = tenantField?.relation  || null;
  _cache.hasVoucherCodeField    = !!voucherField;
  _cache.warehouseId = warehouses[0]?.id || null;
  _cache.customerLocationId = custLocs[0]?.id || null;
  _cache.fallbackRouteId = fallbackRoutes[0]?.id || null;
  _cache.fallbackRouteName = fallbackRoutes[0]?.name || null;
  logger.info('Odoo startup refs resolved', {
    currencyIdIdr: _cache.currencyIdIdr,
    customerLocationId: _cache.customerLocationId,
    hasSosFields: _cache.hasSosTransactionId,
    journals: Object.keys(_cache.journals),
    warehouseId: _cache.warehouseId,
    fallbackRouteId: _cache.fallbackRouteId,
    fallbackRouteName: _cache.fallbackRouteName,
    companyId,
  });
}

function getCache() {
  return _cache;
}

module.exports = { callKw, searchRead, create, write, execute, authenticate, invalidateSession, resolveStartupRefs, getCache };
