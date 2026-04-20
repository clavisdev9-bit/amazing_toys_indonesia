'use strict';

const { OdooProductRepository, REQUIRED_PRODUCT_FIELDS } =
  require('../../infrastructure/odoo/OdooProductRepository');

// ── Stub factories ────────────────────────────────────────────────────────────

function makeHttp() {
  return { callKw: jest.fn().mockResolvedValue(true) };
}

function makeProductAdapter() {
  return { readCurrentQty: jest.fn().mockResolvedValue(20) };
}

function makeStockAdapter() {
  return {
    resolveQuant:            jest.fn().mockResolvedValue({ quantId: 9, qtyBefore: 5, locationId: 8, variantId: 22 }),
    applyInventoryAdjustment: jest.fn().mockResolvedValue({ applied: true }),
  };
}

function makeChatterAdapter() {
  return { postNote: jest.fn().mockResolvedValue(undefined) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OdooProductRepository', () => {
  let repo, http, productAdapter, stockAdapter, chatterAdapter;

  beforeEach(() => {
    http           = makeHttp();
    productAdapter = makeProductAdapter();
    stockAdapter   = makeStockAdapter();
    chatterAdapter = makeChatterAdapter();
    repo = new OdooProductRepository({ httpClient: http, productAdapter, stockAdapter, chatterAdapter });
  });

  // ── ensureProductFields ─────────────────────────────────────────────────────

  describe('ensureProductFields()', () => {
    it('writes type=consu, invoice_policy=order, is_storable=true to product.template', async () => {
      await repo.ensureProductFields(42);

      expect(http.callKw).toHaveBeenCalledWith(
        'product.template', 'write',
        [[42], { type: 'consu', invoice_policy: 'order', is_storable: true }]
      );
    });

    it('uses the REQUIRED_PRODUCT_FIELDS constant — all three keys present', () => {
      // type='consu' is the Odoo internal API value for storable/goods products
      expect(REQUIRED_PRODUCT_FIELDS).toMatchObject({
        type:           'consu',
        invoice_policy: 'order',
        is_storable:    true,
      });
    });

    it('calls callKw exactly once per invocation', async () => {
      await repo.ensureProductFields(10);
      expect(http.callKw).toHaveBeenCalledTimes(1);
    });
  });

  // ── applyStockAdjustment ────────────────────────────────────────────────────

  describe('applyStockAdjustment()', () => {
    it('delegates resolveQuant then applyInventoryAdjustment in order', async () => {
      await repo.applyStockAdjustment(42, 30);

      expect(stockAdapter.resolveQuant).toHaveBeenCalledWith(42);
      expect(stockAdapter.applyInventoryAdjustment).toHaveBeenCalledWith(9, 22, 30);
    });

    it('returns quantId, qtyBefore, locationId, variantId from resolveQuant', async () => {
      const result = await repo.applyStockAdjustment(42, 30);

      expect(result).toEqual({ quantId: 9, qtyBefore: 5, locationId: 8, variantId: 22 });
    });

    it('does not call product.template write (keeps write boundary clean)', async () => {
      await repo.applyStockAdjustment(42, 30);
      expect(http.callKw).not.toHaveBeenCalled();
    });

    it('propagates errors from resolveQuant', async () => {
      stockAdapter.resolveQuant.mockRejectedValueOnce(new Error('Odoo timeout'));
      await expect(repo.applyStockAdjustment(42, 10)).rejects.toThrow('Odoo timeout');
    });
  });

  // ── readCurrentQty ──────────────────────────────────────────────────────────

  describe('readCurrentQty()', () => {
    it('delegates to productAdapter.readCurrentQty', async () => {
      productAdapter.readCurrentQty.mockResolvedValue(25);
      const qty = await repo.readCurrentQty(42);

      expect(productAdapter.readCurrentQty).toHaveBeenCalledWith(42);
      expect(qty).toBe(25);
    });

    it('returns null when productAdapter returns null', async () => {
      productAdapter.readCurrentQty.mockResolvedValue(null);
      await expect(repo.readCurrentQty(99)).resolves.toBeNull();
    });
  });

  // ── postNote ────────────────────────────────────────────────────────────────

  describe('postNote()', () => {
    it('delegates to chatterAdapter.postNote with all note fields', async () => {
      const note = {
        batchId:      'batch-1',
        syncId:       'sync-1',
        qtyBefore:    5,
        qtyConfirmed: 20,
        triggeredBy:  'admin',
        triggeredAt:  new Date('2026-04-19T00:00:00Z'),
      };
      await repo.postNote(42, note);

      expect(chatterAdapter.postNote).toHaveBeenCalledWith(42, note);
    });
  });
});
