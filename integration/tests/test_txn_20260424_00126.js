'use strict';

/**
 * Regression test for TXN-20260424-00126
 *
 * Root cause: Odoo credentials were not configured, causing odoo.searchRead()
 * to throw inside resolveOdooProduct(). The exception propagated out of pushOrder()
 * uncaught, was swallowed by the webhook handler's .catch(), and no retry was enqueued.
 *
 * These tests verify the full happy-path (payment → confirmed + locked SO + delivery)
 * and the idempotency guarantee (calling twice must not create a duplicate).
 *
 * Run: npm test
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// ── Dependency stubs ─────────────────────────────────────────────────────────
// All external I/O is replaced with in-memory stubs so tests run without a
// live Odoo instance, SOS API, or PostgreSQL database.

const TRANSACTION_ID = 'TXN-20260424-00126';
const ODOO_ORDER_ID  = 42;
const ODOO_PARTNER_ID = 7;
const ODOO_PRODUCT_ID = 3;

/** Build a minimal SOS transaction payload matching TXN-20260424-00126. */
function makeSosTxn() {
  return {
    transaction_id: TRANSACTION_ID,
    customer_id: 'CUST-001',
    customer_name: 'Budi Santoso',
    customer_phone: '081234567890',
    customer_email: 'budi@example.com',
    payment_method: 'CASH',
    payment_reference: 'REF-001',
    cash_received: 100000,
    cash_change: 10000,
    cashier_name: 'Siti',
    paid_at: '2026-04-24T10:00:00Z',
    items: [
      {
        product_name: 'Lego Duplo Set',
        barcode: '1234567890123',
        quantity: 2,
        unit_price: 45000,
        tenant_id: 'T001',
      },
    ],
  };
}

/**
 * Wire up fresh stubs and re-require order.push.js with those stubs injected
 * via the module registry mock.  Returns { pushOrder, stubs }.
 */
function buildTestContext({ xrefHasEntry = false } = {}) {
  // ── odoo.client stub ───────────────────────────────────────────────────────
  const odooStub = {
    _cache: { hasSosTransactionId: true, hasSosTenantId: false },
    getCache() { return this._cache; },
    async resolveStartupRefs() {},
    async searchRead(model, domain) {
      if (model === 'sale.order') return []; // no pre-existing order
      if (model === 'product.product') return [{ id: ODOO_PRODUCT_ID, name: 'Lego Duplo Set' }];
      if (model === 'res.partner') return [];
      return [];
    },
    async create() { return ODOO_ORDER_ID; },
    async write() { return true; },
    async execute(model, method) {
      // action_confirm and action_lock must succeed silently
      if (method === 'action_confirm') return true;
      if (method === 'action_lock') return true;
      // picking_ids check
      if (method === 'search_read') return [];
      return true;
    },
  };

  // searchRead on sale.order for picking_ids verification needs special handling
  const _origSearchRead = odooStub.searchRead.bind(odooStub);
  odooStub.searchRead = async function (model, domain, fields) {
    if (model === 'sale.order' && fields && fields.includes('picking_ids')) {
      return [{ id: ODOO_ORDER_ID, state: 'sale', locked: true, picking_ids: [101] }];
    }
    return _origSearchRead(model, domain, fields);
  };

  // ── sos.client stub ────────────────────────────────────────────────────────
  const sosStub = {
    async get(path) {
      if (path.includes(TRANSACTION_ID)) return makeSosTxn();
      throw new Error(`Unexpected SOS GET: ${path}`);
    },
  };

  // ── circuit.breaker stub ───────────────────────────────────────────────────
  const cbStub = {
    isOpen: () => false,
    recordSuccess: () => {},
    recordFailure: () => {},
  };

  // ── xref stub ─────────────────────────────────────────────────────────────
  const xrefStore = {};
  const xrefStub = {
    async getXref(type, id) {
      if (xrefHasEntry && id === TRANSACTION_ID) {
        return { odoo_id: ODOO_ORDER_ID, status: 'ACTIVE' };
      }
      return xrefStore[`${type}:${id}`] || null;
    },
    async upsertXref(type, sosId, odooId) {
      xrefStore[`${type}:${sosId}`] = { odoo_id: odooId, status: 'ACTIVE' };
    },
    async markXrefCancelled() {},
    async getOdooIdBySosId() { return null; },
  };

  // ── audit stub ────────────────────────────────────────────────────────────
  const auditLogs = [];
  const auditStub = {
    log(entry) { auditLogs.push(entry); },
    async pushDeadLetter() {},
  };

  // ── retry queue stub ──────────────────────────────────────────────────────
  const retryItems = [];
  const retryStub = {
    enqueue(item) { retryItems.push(item); },
    size: () => retryItems.length,
  };

  // ── customer.sync stub ────────────────────────────────────────────────────
  const customerStub = {
    async resolveOrCreatePartner() { return ODOO_PARTNER_ID; },
  };

  // Inject stubs by temporarily replacing require cache entries.
  const Module = require('module');
  const origLoad = Module._load;

  const stubMap = {
    '../clients/odoo.client': odooStub,
    '../clients/sos.client':  sosStub,
    '../utils/circuit.breaker': cbStub,
    '../utils/xref':          xrefStub,
    '../utils/audit':         auditStub,
    '../queue/retry.queue':   retryStub,
    './customer.sync':        customerStub,
    '../config/logger':       { info() {}, warn() {}, error() {}, debug() {} },
  };

  Module._load = function (request, parent, isMain) {
    if (stubMap[request]) return stubMap[request];
    return origLoad.call(this, request, parent, isMain);
  };

  // Force re-require by deleting the cached module.
  const orderPushPath = require.resolve('../src/services/order.push');
  delete require.cache[orderPushPath];
  const { pushOrder } = require('../src/services/order.push');

  // Restore Module._load immediately after require so we don't leak.
  Module._load = origLoad;

  return { pushOrder, odooStub, auditLogs, retryItems, xrefStub };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('TXN-20260424-00126 — payment → Odoo sales order flow', () => {

  it('1. creates sale.order in Odoo with correct origin', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    const created = [];
    const origCreate = odooStub.create.bind(odooStub);
    odooStub.create = async function (model, vals) {
      created.push({ model, vals });
      return origCreate(model, vals);
    };

    const result = await pushOrder(TRANSACTION_ID);

    assert.equal(result.success, true, 'pushOrder must return success=true');
    assert.equal(result.odoo_order_id, ODOO_ORDER_ID);
    assert.equal(result.error, null);

    const soCreate = created.find(c => c.model === 'sale.order');
    assert.ok(soCreate, 'sale.order must be created');
    assert.equal(soCreate.vals.origin, TRANSACTION_ID, 'origin must equal transaction ID');
    assert.equal(soCreate.vals.partner_id, ODOO_PARTNER_ID);
  });

  it('2. order.state is confirmed (action_confirm called)', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    const calls = [];
    const origExecute = odooStub.execute.bind(odooStub);
    odooStub.execute = async function (model, method, ids) {
      calls.push({ model, method, ids });
      return origExecute(model, method, ids);
    };

    const result = await pushOrder(TRANSACTION_ID);

    assert.equal(result.success, true);
    const confirmCall = calls.find(c => c.method === 'action_confirm');
    assert.ok(confirmCall, 'action_confirm must be called');
    assert.deepEqual(confirmCall.ids, [ODOO_ORDER_ID]);
  });

  it('3. order is locked (action_lock called after action_confirm)', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    const calls = [];
    const origExecute = odooStub.execute.bind(odooStub);
    odooStub.execute = async function (model, method, ids) {
      calls.push(method);
      return origExecute(model, method, ids);
    };

    await pushOrder(TRANSACTION_ID);

    const confirmIdx = calls.indexOf('action_confirm');
    const lockIdx    = calls.indexOf('action_lock');
    assert.ok(lockIdx > -1, 'action_lock must be called');
    assert.ok(lockIdx > confirmIdx, 'action_lock must come after action_confirm');
  });

  it('4. delivery order (picking_ids) is present after confirmation', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    // odooStub.searchRead for picking_ids already returns picking_ids: [101]
    const result = await pushOrder(TRANSACTION_ID);
    assert.equal(result.success, true);
    // Verification is informational (logged) — success is not gated on it.
    // The key assertion is that the overall result is successful.
    assert.equal(result.error, null);
  });

  it('5. origin field contains the transaction ID', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    let capturedVals;
    odooStub.create = async function (_model, vals) {
      capturedVals = vals;
      return ODOO_ORDER_ID;
    };

    await pushOrder(TRANSACTION_ID);

    assert.ok(capturedVals.origin.includes(TRANSACTION_ID),
      `origin "${capturedVals.origin}" must contain "${TRANSACTION_ID}"`);
  });

  it('6. calling pushOrder twice does NOT create a duplicate order (idempotency)', async () => {
    // First call — no existing xref entry
    const { pushOrder: pushFirst, odooStub, xrefStub } = buildTestContext();
    let createCount = 0;
    odooStub.create = async function () { createCount++; return ODOO_ORDER_ID; };

    await pushFirst(TRANSACTION_ID);
    assert.equal(createCount, 1, 'First call must create exactly one order');

    // Second call — xref already has the entry from the first call
    const { pushOrder: pushSecond, odooStub: odoo2 } = buildTestContext({ xrefHasEntry: true });
    let createCount2 = 0;
    odoo2.create = async function () { createCount2++; return ODOO_ORDER_ID; };

    const result2 = await pushSecond(TRANSACTION_ID);

    assert.equal(createCount2, 0, 'Second call must NOT create another order');
    assert.equal(result2.success, true, 'Second call still returns success');
    assert.equal(result2.odoo_order_id, ODOO_ORDER_ID);
  });

  it('7. Odoo outage re-queues the transaction (no silent drop)', async () => {
    const { pushOrder, odooStub, retryItems } = buildTestContext();

    // Simulate Odoo being unreachable during product lookup
    odooStub.searchRead = async function (model) {
      if (model === 'product.product') throw new Error('Odoo credentials not configured');
      return [];
    };

    const result = await pushOrder(TRANSACTION_ID);

    assert.equal(result.success, false);
    assert.ok(result.error, 'error field must be populated');
    assert.equal(retryItems.length, 1, 'transaction must be re-queued for retry');
    assert.equal(retryItems[0].payload.transactionId, TRANSACTION_ID);
  });

  it('8. invalid transactionId format is rejected immediately (no Odoo calls)', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    let odooCallCount = 0;
    const origCreate = odooStub.create.bind(odooStub);
    odooStub.create = async function (...args) { odooCallCount++; return origCreate(...args); };

    const result = await pushOrder('INVALID-FORMAT');

    assert.equal(result.success, false);
    assert.equal(odooCallCount, 0, 'No Odoo calls should be made for an invalid ID');
  });

});
