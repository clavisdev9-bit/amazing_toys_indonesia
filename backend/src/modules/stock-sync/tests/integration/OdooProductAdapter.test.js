'use strict';

const { OdooProductAdapter } = require('../../infrastructure/odoo/OdooProductAdapter');

function makeHttp(overrides = {}) {
  return { callKw: jest.fn(), authenticate: jest.fn().mockResolvedValue('session=x'), ...overrides };
}

describe('OdooProductAdapter', () => {
  let adapter, http;

  beforeEach(() => {
    http    = makeHttp();
    adapter = new OdooProductAdapter(http);
  });

  // ── readEligibilityFields ───────────────────────────────────────────────────

  describe('readEligibilityFields()', () => {
    it('returns type, invoice_policy, is_storable from product.template', async () => {
      http.callKw.mockResolvedValue([{
        id: 42, type: 'consu', invoice_policy: 'order', is_storable: true,
      }]);
      const fields = await adapter.readEligibilityFields(42);
      expect(fields.type).toBe('consu');
      expect(fields.invoice_policy).toBe('order');
      expect(fields.is_storable).toBe(true);
    });

    it('throws when product.template not found', async () => {
      http.callKw.mockResolvedValue([]);
      await expect(adapter.readEligibilityFields(99)).rejects.toThrow('not found');
    });

    it('calls product.template read with the three eligibility fields', async () => {
      http.callKw.mockResolvedValue([{ id: 42, type: 'consu', invoice_policy: 'order', is_storable: true }]);
      await adapter.readEligibilityFields(42);
      expect(http.callKw).toHaveBeenCalledWith(
        'product.template', 'read',
        [[42]],
        { fields: ['type', 'invoice_policy', 'is_storable'] }
      );
    });
  });

  // ── readCurrentQty ──────────────────────────────────────────────────────────

  describe('readCurrentQty()', () => {
    it('returns qty_available from product.template', async () => {
      http.callKw.mockResolvedValue([{ id: 42, qty_available: 7.0 }]);
      const qty = await adapter.readCurrentQty(42);
      expect(qty).toBe(7.0);
    });

    it('returns null when Odoo returns empty array', async () => {
      http.callKw.mockResolvedValue([]);
      const qty = await adapter.readCurrentQty(99);
      expect(qty).toBeNull();
    });
  });
});
