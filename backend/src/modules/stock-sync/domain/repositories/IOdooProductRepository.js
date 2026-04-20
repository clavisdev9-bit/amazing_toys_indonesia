'use strict';

/**
 * Contract for all write operations against Odoo product.template.
 * All Odoo field writes must flow through this repository.
 */
class IOdooProductRepository {
  /**
   * Write the three mandatory product fields to product.template in Odoo.
   * Called before every stock adjustment to enforce correct product configuration.
   *
   * @param {number} templateId
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async ensureProductFields(templateId) { throw new Error('Not implemented'); }

  /**
   * Apply an absolute inventory adjustment via stock.quant.
   * Resolves (or creates) the quant, then calls action_apply_inventory.
   *
   * @param {number} templateId
   * @param {number} qty  — target on-hand quantity (absolute)
   * @returns {Promise<{quantId: number, qtyBefore: number, locationId: number, variantId: number}>}
   */
  // eslint-disable-next-line no-unused-vars
  async applyStockAdjustment(templateId, qty) { throw new Error('Not implemented'); }

  /**
   * Read qty_available from product.template after adjustment.
   *
   * @param {number} templateId
   * @returns {Promise<number|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async readCurrentQty(templateId) { throw new Error('Not implemented'); }

  /**
   * Post an internal chatter note on product.template after sync.
   *
   * @param {number} templateId
   * @param {object} note
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async postNote(templateId, note) { throw new Error('Not implemented'); }
}

module.exports = { IOdooProductRepository };
