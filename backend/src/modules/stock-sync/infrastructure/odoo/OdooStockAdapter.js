'use strict';

const { ProductNotFoundError } = require('../../domain/errors/errors');
const logger = require('../../../../config/logger');

/**
 * Odoo adapter for stock quantity adjustments via stock.quant (Odoo 16+/18).
 *
 * Flow per product:
 *   1. Resolve WH/Stock location + inventory-adjustment virtual location (both cached).
 *   2. Resolve product.product variant ID.
 *   3. Find or create stock.quant for variant + location.
 *   4. Ensure property_stock_inventory is set on the variant (required by action_apply_inventory).
 *   5. Write inventory_quantity + call action_apply_inventory (absolute, idempotent).
 */
class OdooStockAdapter {
  /** @param {import('../http/OdooHttpClient').OdooHttpClient} httpClient */
  constructor(httpClient) {
    this._http          = httpClient;
    this._locationId    = null;   // WH/Stock location ID  (cached)
    this._invAdjLocId   = null;   // Virtual inventory-adjustment location ID (cached)
  }

  // ── Warehouse / location bootstrap ─────────────────────────────────────────

  /**
   * Load and cache both the main stock location and the virtual inventory-adjustment
   * location for the same company.  Called lazily; only one RPC round-trip.
   */
  async _initWarehouse() {
    if (this._locationId) return;

    const warehouses = await this._http.callKw(
      'stock.warehouse', 'search_read', [[]],
      { fields: ['id', 'lot_stock_id', 'company_id'], limit: 1 }
    );

    if (warehouses?.length && warehouses[0].lot_stock_id?.[0]) {
      this._locationId = warehouses[0].lot_stock_id[0];
      const companyId  = warehouses[0].company_id?.[0];

      // Find the virtual inventory-adjustment location for this company
      const adjLocs = await this._http.callKw(
        'stock.location', 'search_read',
        [[['usage', '=', 'inventory'], ['company_id', '=', companyId]]],
        { fields: ['id', 'name'], limit: 1 }
      );
      this._invAdjLocId = adjLocs?.[0]?.id ?? null;
      return;
    }

    // Fallback — search by name (multi-warehouse edge case)
    const locations = await this._http.callKw(
      'stock.location', 'search_read',
      [[['usage', '=', 'internal'], ['complete_name', 'ilike', 'WH/Stock']]],
      { fields: ['id', 'complete_name'], limit: 1 }
    );
    if (!locations?.length) throw new Error('Main stock location (WH/Stock) not found in Odoo.');
    this._locationId = locations[0].id;

    // Also cache inventory adjustment location without company constraint
    const adjLocs = await this._http.callKw(
      'stock.location', 'search_read',
      [[['usage', '=', 'inventory'], ['name', '=', 'Inventory adjustment']]],
      { fields: ['id'], limit: 1 }
    );
    this._invAdjLocId = adjLocs?.[0]?.id ?? null;
  }

  /** @returns {Promise<number>} */
  async getMainLocationId() {
    await this._initWarehouse();
    if (!this._locationId) throw new Error('Main stock location (WH/Stock) not found in Odoo.');
    return this._locationId;
  }

  /** @returns {Promise<number>} */
  async _getInventoryAdjLocationId() {
    await this._initWarehouse();
    if (!this._invAdjLocId) throw new Error('Inventory adjustment virtual location not found in Odoo.');
    return this._invAdjLocId;
  }

  // ── Quant resolution ────────────────────────────────────────────────────────

  /**
   * Get the product.product (variant) ID from a product.template ID.
   * @param {number} templateId
   * @returns {Promise<number>}
   */
  async getVariantId(templateId) {
    const variants = await this._http.callKw(
      'product.product', 'search_read',
      [[['product_tmpl_id', '=', templateId]]],
      { fields: ['id'], limit: 1 }
    );
    if (!variants?.length) throw new ProductNotFoundError(`template:${templateId}`);
    return variants[0].id;
  }

  /**
   * Find or create the stock.quant for a product in the main WH/Stock location.
   *
   * @param {number} templateId — product.template ID
   * @returns {Promise<{quantId: number, qtyBefore: number, locationId: number, variantId: number}>}
   */
  async resolveQuant(templateId) {
    const [locationId, variantId] = await Promise.all([
      this.getMainLocationId(),
      this.getVariantId(templateId),
    ]);

    const quants = await this._http.callKw(
      'stock.quant', 'search_read',
      [[['product_id', '=', variantId], ['location_id', '=', locationId]]],
      { fields: ['id', 'quantity'] }
    );

    if (quants?.length) {
      return { quantId: quants[0].id, qtyBefore: Number(quants[0].quantity), locationId, variantId };
    }

    // No quant exists yet — create a zero-quantity placeholder
    const quantId = await this._http.callKw(
      'stock.quant', 'create',
      [{ product_id: variantId, location_id: locationId, inventory_quantity: 0 }]
    );
    return { quantId, qtyBefore: 0, locationId, variantId };
  }

  // ── Inventory adjustment ────────────────────────────────────────────────────

  /**
   * Apply an absolute inventory adjustment to a quant (idempotent).
   *
   * Odoo's action_apply_inventory creates a stock.move using
   * product.property_stock_inventory as the virtual source/dest location.
   * If that property is unset (False), the move creation fails.
   * We resolve and set it here before calling the method.
   *
   * @param {number} quantId
   * @param {number} variantId   — product.product ID (from resolveQuant)
   * @param {number} newQty
   * @returns {Promise<object>}
   */
  async applyInventoryAdjustment(quantId, variantId, newQty) {
    const invAdjLocId = await this._getInventoryAdjLocationId();

    // Ensure property_stock_inventory is set for this variant so that
    // action_apply_inventory can create the stock.move with the correct locations.
    await this._http.callKw(
      'product.product', 'write',
      [[variantId], { property_stock_inventory: invAdjLocId }]
    );

    await this._http.callKw(
      'stock.quant', 'write',
      [[quantId], { inventory_quantity: newQty }]
    );
    logger.info(
      `[SYNC-TRACE][CP-6] PASS | stock.quant write quantId=${quantId} inventory_quantity=${newQty} variantId=${variantId}`
    );

    const response = await this._http.callKw(
      'stock.quant', 'action_apply_inventory',
      [[quantId]], {}
    );
    logger.info(
      `[SYNC-TRACE][CP-7] PASS | action_apply_inventory([[${quantId}]]) completed`
    );
    return response ?? { applied: true };
  }

  // ── Chatter note ────────────────────────────────────────────────────────────

  /**
   * Post a chatter note (internal log) on product.template after sync.
   *
   * @param {number} templateId
   * @param {object} note
   * @param {string} note.syncId
   * @param {number} note.qtyBefore
   * @param {number} note.qtyAfter
   * @param {string} note.triggeredBy
   * @param {Date}   note.triggeredAt
   */
  async postChatterNote(templateId, { syncId, qtyBefore, qtyAfter, triggeredBy, triggeredAt }) {
    const body = [
      '<p><strong>SOS Stock Sync</strong></p>',
      '<ul>',
      `  <li><b>Sync ID:</b> ${syncId}</li>`,
      `  <li><b>Previous qty:</b> ${qtyBefore ?? '—'} → <b>New qty:</b> ${qtyAfter}</li>`,
      `  <li><b>Synced by:</b> ${triggeredBy}</li>`,
      `  <li><b>Synced at:</b> ${new Date(triggeredAt).toISOString()}</li>`,
      '</ul>',
    ].join('\n');

    await this._http.callKw(
      'product.template', 'message_post',
      [[templateId]],
      { body, message_type: 'comment', subtype_xmlid: 'mail.mt_note' }
    );
  }
}

module.exports = { OdooStockAdapter };
