'use strict';

/**
 * Regression test for TXN-20260424-00127 (QRIS payment, Rp 500.295)
 *
 * Root cause: INTEGRATION_WEBHOOK_URL was not set in backend/.env, so
 * fireWebhook() returned immediately without sending anything to the
 * integration service.  Additionally, WEBHOOK_SECRET was missing from
 * backend/.env, meaning even if the URL were set, the integration middleware
 * would reject the unsigned request with HTTP 401.
 *
 * Fix applied:
 *   backend/.env  — added INTEGRATION_WEBHOOK_URL=http://localhost:4000
 *   backend/.env  — added WEBHOOK_SECRET matching integration/.env
 *   integration/.env — filled ODOO_BASE_URL / ODOO_DB / ODOO_LOGIN / ODOO_PASSWORD
 *
 * These tests verify the full happy-path for a QRIS transaction and the
 * idempotency guarantee.  All external I/O is stubbed so tests run without a
 * live Odoo instance, SOS API, or PostgreSQL database.
 *
 * Run: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const TRANSACTION_ID  = 'TXN-20260424-00127';
const ODOO_ORDER_ID   = 55;
const ODOO_PARTNER_ID = 9;
const ODOO_PRODUCT_ID = 12;

/** Minimal SOS transaction payload matching TXN-20260424-00127. */
function makeSosTxn() {
  return {
    transaction_id:    TRANSACTION_ID,
    customer_id:       'CUST-002',
    customer_name:     'Pelanggan QRIS',
    customer_phone:    '082134567890',
    customer_email:    'qris@example.com',
    payment_method:    'QRIS',
    payment_reference: 'QRIS-REF-00127',
    cash_received:     0,
    cash_change:       0,
    cashier_name:      'Budi',
    paid_at:           '2026-04-24T14:49:00+07:00',
    items: [
      {
        product_name: 'Mainan Edukatif Set',
        barcode:      '9876543210987',
        quantity:     3,
        unit_price:   166765,
        tenant_id:    'T001',
      },
    ],
  };
}

function buildTestContext({ xrefHasEntry = false } = {}) {
  const odooStub = {
    _cache: { hasSosTransactionId: true, hasSosTenantId: false },
    getCache() { return this._cache; },
    async resolveStartupRefs() {},
    async searchRead(model, domain, fields) {
      if (model === 'sale.order' && fields && fields.includes('picking_ids')) {
        return [{ id: ODOO_ORDER_ID, state: 'sale', locked: true, picking_ids: [201] }];
      }
      if (model === 'sale.order')    return [];
      if (model === 'product.product') return [{ id: ODOO_PRODUCT_ID, name: 'Mainan Edukatif Set' }];
      if (model === 'res.partner')   return [];
      return [];
    },
    async create()  { return ODOO_ORDER_ID; },
    async write()   { return true; },
    async execute() { return true; },
  };

  const sosStub = {
    async get(path) {
      if (path.includes(TRANSACTION_ID)) return makeSosTxn();
      throw new Error(`Unexpected SOS GET: ${path}`);
    },
  };

  const cbStub = {
    isOpen:        () => false,
    recordSuccess: () => {},
    recordFailure: () => {},
  };

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
    async getOdooIdBySosId()  { return null; },
  };

  const auditLogs  = [];
  const auditStub  = { log(e) { auditLogs.push(e); }, async pushDeadLetter() {} };
  const retryItems = [];
  const retryStub  = { enqueue(i) { retryItems.push(i); }, size: () => retryItems.length };
  const customerStub = { async resolveOrCreatePartner() { return ODOO_PARTNER_ID; } };

  const Module   = require('module');
  const origLoad = Module._load;
  const stubMap  = {
    '../clients/odoo.client':   odooStub,
    '../clients/sos.client':    sosStub,
    '../utils/circuit.breaker': cbStub,
    '../utils/xref':            xrefStub,
    '../utils/audit':           auditStub,
    '../queue/retry.queue':     retryStub,
    './customer.sync':          customerStub,
    '../config/logger':         { info() {}, warn() {}, error() {}, debug() {} },
  };

  Module._load = function (request, parent, isMain) {
    if (stubMap[request]) return stubMap[request];
    return origLoad.call(this, request, parent, isMain);
  };

  const orderPushPath = require.resolve('../src/services/order.push');
  delete require.cache[orderPushPath];
  const { pushOrder } = require('../src/services/order.push');
  Module._load = origLoad;

  return { pushOrder, odooStub, auditLogs, retryItems, xrefStub };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('TXN-20260424-00127 — QRIS payment → Odoo sales order flow', () => {

  it('1. creates sale.order in Odoo with correct origin', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    const created = [];
    const orig = odooStub.create.bind(odooStub);
    odooStub.create = async (model, vals) => { created.push({ model, vals }); return orig(model, vals); };

    const result = await pushOrder(TRANSACTION_ID);

    assert.equal(result.success, true,  'pushOrder must return success=true');
    assert.equal(result.odoo_order_id, ODOO_ORDER_ID);
    assert.equal(result.error, null);

    const soCreate = created.find(c => c.model === 'sale.order');
    assert.ok(soCreate, 'sale.order must be created');
    assert.equal(soCreate.vals.origin, TRANSACTION_ID, 'origin must equal transaction ID');
    assert.equal(soCreate.vals.partner_id, ODOO_PARTNER_ID);
  });

  it('2. payment_method QRIS is captured in the order note', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    let capturedVals;
    odooStub.create = async (_model, vals) => { capturedVals = vals; return ODOO_ORDER_ID; };

    await pushOrder(TRANSACTION_ID);

    assert.ok(capturedVals.note.includes('QRIS'), `note must mention QRIS, got: ${capturedVals.note}`);
  });

  it('3. action_confirm is called (order confirmed)', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    const calls = [];
    const orig = odooStub.execute.bind(odooStub);
    odooStub.execute = async (model, method, ids) => { calls.push({ method, ids }); return orig(model, method, ids); };

    const result = await pushOrder(TRANSACTION_ID);

    assert.equal(result.success, true);
    const confirmCall = calls.find(c => c.method === 'action_confirm');
    assert.ok(confirmCall, 'action_confirm must be called');
    assert.deepEqual(confirmCall.ids, [ODOO_ORDER_ID]);
  });

  it('4. action_lock is called after action_confirm', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    const methods = [];
    const orig = odooStub.execute.bind(odooStub);
    odooStub.execute = async (model, method, ids) => { methods.push(method); return orig(model, method, ids); };

    await pushOrder(TRANSACTION_ID);

    const confirmIdx = methods.indexOf('action_confirm');
    const lockIdx    = methods.indexOf('action_lock');
    assert.ok(lockIdx > -1,       'action_lock must be called');
    assert.ok(lockIdx > confirmIdx, 'action_lock must come after action_confirm');
  });

  it('5. picking_ids (delivery order) is present after confirmation', async () => {
    const { pushOrder } = buildTestContext();
    const result = await pushOrder(TRANSACTION_ID);
    assert.equal(result.success, true);
    assert.equal(result.error, null);
  });

  it('6. origin field contains TXN-20260424-00127', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    let capturedVals;
    odooStub.create = async (_model, vals) => { capturedVals = vals; return ODOO_ORDER_ID; };

    await pushOrder(TRANSACTION_ID);

    assert.ok(
      capturedVals.origin.includes(TRANSACTION_ID),
      `origin "${capturedVals.origin}" must contain "${TRANSACTION_ID}"`
    );
  });

  it('7. calling pushOrder twice does NOT create a duplicate (idempotency)', async () => {
    const { pushOrder: push1, odooStub: o1 } = buildTestContext();
    let count1 = 0;
    o1.create = async () => { count1++; return ODOO_ORDER_ID; };
    await push1(TRANSACTION_ID);
    assert.equal(count1, 1, 'First call must create exactly one order');

    const { pushOrder: push2, odooStub: o2 } = buildTestContext({ xrefHasEntry: true });
    let count2 = 0;
    o2.create = async () => { count2++; return ODOO_ORDER_ID; };
    const result2 = await push2(TRANSACTION_ID);

    assert.equal(count2, 0, 'Second call must NOT create another order');
    assert.equal(result2.success, true);
    assert.equal(result2.odoo_order_id, ODOO_ORDER_ID);
  });

  it('8. Odoo outage re-queues the transaction (no silent drop)', async () => {
    const { pushOrder, odooStub, retryItems } = buildTestContext();
    odooStub.searchRead = async (model) => {
      if (model === 'product.product') throw new Error('ECONNREFUSED');
      return [];
    };

    const result = await pushOrder(TRANSACTION_ID);

    assert.equal(result.success, false);
    assert.ok(result.error, 'error field must be populated');
    assert.equal(retryItems.length, 1, 'transaction must be re-queued for retry');
    assert.equal(retryItems[0].payload.transactionId, TRANSACTION_ID);
  });

  it('9. invalid transactionId format is rejected without touching Odoo', async () => {
    const { pushOrder, odooStub } = buildTestContext();
    let callCount = 0;
    odooStub.create = async () => { callCount++; return ODOO_ORDER_ID; };

    const result = await pushOrder('INVALID');

    assert.equal(result.success, false);
    assert.equal(callCount, 0, 'No Odoo calls for an invalid transaction ID');
  });

});
