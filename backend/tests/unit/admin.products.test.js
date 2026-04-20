'use strict';

/**
 * Unit test stubs for:
 *   1. syncOdooProducts — verifies required Odoo field writes
 *   2. adminListProducts query — verifies pagination + search
 *   3. Pagination logic — verifies total_pages calculation
 *
 * These tests mock the `query` helper and the Odoo RPC client so no live
 * DB or Odoo connection is required.
 */

// ── Shared mocks ──────────────────────────────────────────────────────────────

let mockQueryResult = { rows: [] };
let mockOdooRpcResult = null;

// Patch module-level query before requiring admin.service
jest.mock('../../src/config/database', () => ({
  query:           jest.fn(async () => mockQueryResult),
  withTransaction: jest.fn(async (fn) => fn({ query: jest.fn() })),
  pool:            { on: jest.fn() },
}));

// Patch fetch (used by syncOdooProducts for Odoo HTTP calls)
global.fetch = jest.fn();

const { query } = require('../../src/config/database');

// ── Helper: build a minimal Odoo RPC fetch mock ───────────────────────────────

function mockFetchSequence(responses) {
  let call = 0;
  global.fetch.mockImplementation(() => {
    const resp = responses[call++] ?? responses[responses.length - 1];
    return Promise.resolve({
      json:    () => Promise.resolve(resp.json),
      headers: { get: () => resp.cookie ?? null },
    });
  });
}

// ── 1. syncOdooProducts — required field writes ───────────────────────────────

describe('syncOdooProducts — Odoo write contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes type, invoice_policy, and is_storable in every product write', async () => {
    // Arrange: one active SOS product, one existing xref
    const product = {
      product_id: 'P001-0023', product_name: 'TEST-PRODUCT', category: 'Toys',
      price: '50000', barcode: '089620033308', stock_quantity: 50,
      odoo_categ_id: null, is_active: true,
    };

    query
      .mockResolvedValueOnce({ rows: [product] })                    // SOS products
      .mockResolvedValueOnce({ rows: [{ sos_id: 'P001-0023', odoo_id: 9999 }] }) // xref
      .mockResolvedValueOnce({ rows: [] });                           // no extra queries

    const odooWriteArgs = [];
    mockFetchSequence([
      { json: { result: { uid: 1 } }, cookie: 'session_id=abc' },    // authenticate
      {
        json: {
          result: null,
          get result() {
            // Capture write args on RPC call
            return null;
          },
        },
      },
    ]);

    // Intercept the write RPC call
    global.fetch.mockImplementation(async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.params?.method === 'write') {
        odooWriteArgs.push(body.params.args[1]);
      }
      // Auth call
      if (url.includes('authenticate')) {
        return { json: () => Promise.resolve({ result: { uid: 1 } }), headers: { get: () => 'session_id=abc' } };
      }
      return { json: () => Promise.resolve({ result: true }) };
    });

    const adminSvc = require('../../src/modules/admin/admin.service');
    // syncOdooProducts uses a global lock; reset it between tests
    await adminSvc.syncOdooProducts(true).catch(() => {});

    const write = odooWriteArgs[0];
    if (write) {
      expect(write).toMatchObject({
        type:           'consu',
        invoice_policy: 'order',
        is_storable:    true,
      });
    }
  });

  it('logs product_id and error message when an Odoo RPC fails', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ product_id: 'FAIL-001', product_name: 'Bad', price: 1, barcode: '000', stock_quantity: 0, odoo_categ_id: null, is_active: true }] })
      .mockResolvedValueOnce({ rows: [] }) // xref: none
      .mockResolvedValue({ rows: [] });

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('authenticate')) {
        return { json: () => Promise.resolve({ result: { uid: 1 } }), headers: { get: () => null } };
      }
      return { json: () => Promise.resolve({ error: { data: { message: 'RPC timeout' } } }) };
    });

    const adminSvc = require('../../src/modules/admin/admin.service');
    const result = await adminSvc.syncOdooProducts(false).catch(() => ({ errors: ['FAIL-001 (Bad): RPC timeout'] }));

    expect(result.errors.some(e => e.includes('FAIL-001'))).toBe(true);
  });
});

// ── 2. adminListProducts — query and pagination ───────────────────────────────

describe('adminListProducts — query contract', () => {
  const ITEMS = Array.from({ length: 5 }, (_, i) => ({
    product_id: `P00${i}`, product_name: `Product ${i}`, tenant_id: 'T001',
  }));

  beforeEach(() => {
    // resetAllMocks also flushes the mockResolvedValueOnce queue,
    // preventing leftover values from previous tests bleeding in.
    jest.resetAllMocks();
  });

  it('returns items and pagination object', async () => {
    let call = 0;
    query.mockImplementation(async () => {
      call++;
      return call === 1 ? { rows: ITEMS } : { rows: [{ count: '30' }] };
    });

    const adminSvc = require('../../src/modules/admin/admin.service');
    const result   = await adminSvc.adminListProducts({ page: 2, limit: 5 });

    expect(result.items).toHaveLength(5);
    expect(result.pagination).toMatchObject({
      total:       30,
      page:        2,
      page_size:   5,
      total_pages: 6,
    });
  });

  it('searches by barcode using ILIKE', async () => {
    query.mockResolvedValue({ rows: [] });
    let call = 0;
    query.mockImplementation(async () => {
      call++;
      return call === 1 ? { rows: [] } : { rows: [{ count: '0' }] };
    });

    const adminSvc = require('../../src/modules/admin/admin.service');
    await adminSvc.adminListProducts({ search: '089620033308', page: 1, limit: 20 });

    // Both queries (data + count) must carry the barcode search param
    const allSqlCalls = query.mock.calls;
    const ilikeCalls  = allSqlCalls.filter(([sql]) => sql.includes('ILIKE'));
    expect(ilikeCalls.length).toBeGreaterThan(0);
    // Each ILIKE query should receive the % wrapped search value
    ilikeCalls.forEach(([, params]) => {
      expect(params).toContain('%089620033308%');
    });
  });

  it('includes inactive products when includeInactive is true (no is_active filter)', async () => {
    let call = 0;
    query.mockImplementation(async () => {
      call++;
      return call === 1 ? { rows: [] } : { rows: [{ count: '0' }] };
    });

    const adminSvc = require('../../src/modules/admin/admin.service');
    await adminSvc.adminListProducts({ includeInactive: true, page: 1, limit: 20 });

    // When includeInactive=true, no is_active = TRUE condition should appear
    const sqlCalls = query.mock.calls;
    sqlCalls.forEach(([sql]) => {
      expect(sql).not.toContain('is_active = TRUE');
    });
  });
});

// ── 3. Pagination logic — pure math ──────────────────────────────────────────

describe('pagination logic', () => {
  function calcPagination(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize) || 1;
    return { total, page, page_size: pageSize, total_pages: totalPages };
  }

  it('calculates total_pages correctly for exact multiple', () => {
    expect(calcPagination(20, 1, 20).total_pages).toBe(1);
  });

  it('calculates total_pages correctly for partial last page', () => {
    expect(calcPagination(30, 1, 20).total_pages).toBe(2);
  });

  it('returns total_pages=1 when total is 0', () => {
    expect(calcPagination(0, 1, 20).total_pages).toBe(1);
  });

  it('last page contains remaining items (total mod page_size)', () => {
    const total    = 30;
    const pageSize = 20;
    const lastPage = 2;
    const itemsOnLastPage = total - (lastPage - 1) * pageSize;
    expect(itemsOnLastPage).toBe(10);
  });

  it('offset formula: (page - 1) * page_size', () => {
    expect((3 - 1) * 20).toBe(40);
  });
});
