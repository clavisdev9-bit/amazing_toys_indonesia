'use strict';

const { OdooStockAdapter }   = require('../../infrastructure/odoo/OdooStockAdapter');
const { ProductNotFoundError } = require('../../domain/errors/errors');

// ── Stub factory ──────────────────────────────────────────────────────────────

function makeHttp(overrides = {}) {
  return { callKw: jest.fn(), authenticate: jest.fn().mockResolvedValue('session=x'), ...overrides };
}

const WAREHOUSE_ROWS  = [{ id: 1, lot_stock_id: [5, 'WH/Stock'], company_id: [1, 'Student'] }];
const INV_ADJ_LOC_ROW = [{ id: 14, name: 'Inventory adjustment' }];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OdooStockAdapter', () => {
  let adapter, http;

  beforeEach(() => {
    http    = makeHttp();
    adapter = new OdooStockAdapter(http);
  });

  // ── getMainLocationId ───────────────────────────────────────────────────────

  describe('getMainLocationId()', () => {
    it('returns lot_stock_id from the first active warehouse', async () => {
      http.callKw
        .mockResolvedValueOnce(WAREHOUSE_ROWS)  // warehouse
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW); // inv adj loc
      await expect(adapter.getMainLocationId()).resolves.toBe(5);
    });

    it('falls back to stock.location search when lot_stock_id is falsy', async () => {
      http.callKw
        .mockResolvedValueOnce([{ id: 1, lot_stock_id: false, company_id: [1, 'Student'] }])
        .mockResolvedValueOnce([{ id: 7, complete_name: 'WH/Stock' }]) // location by name
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW);                       // inv adj (fallback path)
      await expect(adapter.getMainLocationId()).resolves.toBe(7);
    });

    it('caches location ID and calls Odoo only once per adapter instance', async () => {
      http.callKw
        .mockResolvedValue([])           // default (won't be used after cache warms)
        .mockResolvedValueOnce(WAREHOUSE_ROWS)
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW);
      await adapter.getMainLocationId();
      await adapter.getMainLocationId();
      // _initWarehouse makes 2 calls and is only triggered once
      expect(http.callKw).toHaveBeenCalledTimes(2);
    });

    it('throws when no internal stock location exists', async () => {
      http.callKw
        .mockResolvedValueOnce([{ id: 1, lot_stock_id: false, company_id: [1, 'Student'] }])
        .mockResolvedValueOnce([])  // location by name: empty
        .mockResolvedValueOnce([]); // inv adj: empty (reached only if no throw before)
      await expect(adapter.getMainLocationId()).rejects.toThrow('not found');
    });
  });

  // ── resolveQuant ────────────────────────────────────────────────────────────
  //
  // resolveQuant runs Promise.all([getMainLocationId(), getVariantId()]).
  // _initWarehouse makes two sequential RPC calls internally.
  // Because of parallel execution the RPC call order is:
  //   1. stock.warehouse (from _initWarehouse first await)
  //   2. product.product (from getVariantId — parallel!)
  //   3. stock.location/inv-adj (from _initWarehouse second await)
  //   4. stock.quant (quant search)

  describe('resolveQuant()', () => {
    it('returns existing quant id, current quantity, locationId and variantId', async () => {
      http.callKw
        .mockResolvedValueOnce(WAREHOUSE_ROWS)              // 1. warehouse
        .mockResolvedValueOnce([{ id: 22 }])                // 2. variant (parallel)
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW)             // 3. inv adj loc
        .mockResolvedValueOnce([{ id: 99, quantity: 15 }]); // 4. quant

      const { quantId, qtyBefore, locationId, variantId } = await adapter.resolveQuant(42);
      expect(quantId).toBe(99);
      expect(qtyBefore).toBe(15);
      expect(locationId).toBe(5);
      expect(variantId).toBe(22);
    });

    it('creates a zero-qty quant when none exists and returns qtyBefore=0', async () => {
      http.callKw
        .mockResolvedValueOnce(WAREHOUSE_ROWS)   // 1. warehouse
        .mockResolvedValueOnce([{ id: 22 }])     // 2. variant
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW)  // 3. inv adj loc
        .mockResolvedValueOnce([])               // 4. quant: empty
        .mockResolvedValueOnce(101);             // 5. create → new id

      const { quantId, qtyBefore, locationId, variantId } = await adapter.resolveQuant(42);
      expect(quantId).toBe(101);
      expect(qtyBefore).toBe(0);
      expect(locationId).toBe(5);
      expect(variantId).toBe(22);
    });

    it('throws ProductNotFoundError when product has no variant', async () => {
      http.callKw
        .mockResolvedValueOnce(WAREHOUSE_ROWS)  // 1. warehouse
        .mockResolvedValueOnce([])              // 2. variant: empty → throws
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW); // 3. inv adj (runs concurrently but doesn't matter)
      await expect(adapter.resolveQuant(999)).rejects.toBeInstanceOf(ProductNotFoundError);
    });
  });

  // ── applyInventoryAdjustment ────────────────────────────────────────────────

  describe('applyInventoryAdjustment()', () => {
    // Prime the warehouse cache so assertions only cover the 3 adjustment calls.
    beforeEach(async () => {
      http.callKw
        .mockResolvedValueOnce(WAREHOUSE_ROWS)
        .mockResolvedValueOnce(INV_ADJ_LOC_ROW);
      await adapter.getMainLocationId();
      http.callKw.mockClear();
    });

    it('sets property_stock_inventory, writes inventory_quantity, then calls action_apply_inventory', async () => {
      http.callKw.mockResolvedValue(true);
      await adapter.applyInventoryAdjustment(7, 22, 20);

      expect(http.callKw).toHaveBeenNthCalledWith(
        1, 'product.product', 'write', [[22], { property_stock_inventory: 14 }]
      );
      expect(http.callKw).toHaveBeenNthCalledWith(
        2, 'stock.quant', 'write', [[7], { inventory_quantity: 20 }]
      );
      expect(http.callKw).toHaveBeenNthCalledWith(
        3, 'stock.quant', 'action_apply_inventory', [[7]], {}
      );
    });

    it('returns a default {applied:true} object when Odoo returns null', async () => {
      http.callKw.mockResolvedValue(null);
      const result = await adapter.applyInventoryAdjustment(7, 22, 5);
      expect(result).toEqual({ applied: true });
    });
  });

  // ── postChatterNote ─────────────────────────────────────────────────────────

  describe('postChatterNote()', () => {
    it('calls message_post with the correct model and contains sync metadata in body', async () => {
      http.callKw.mockResolvedValue(1);
      await adapter.postChatterNote(42, {
        syncId:      'uuid-1',
        qtyBefore:   10,
        qtyAfter:    15,
        triggeredBy: 'admin',
        triggeredAt: new Date('2026-04-19T00:00:00Z'),
      });

      expect(http.callKw).toHaveBeenCalledWith(
        'product.template', 'message_post',
        [[42]],
        expect.objectContaining({
          message_type:  'comment',
          subtype_xmlid: 'mail.mt_note',
          body:          expect.stringContaining('uuid-1'),
        })
      );
      const body = http.callKw.mock.calls[0][3].body;
      expect(body).toContain('10');
      expect(body).toContain('15');
      expect(body).toContain('admin');
    });
  });
});
