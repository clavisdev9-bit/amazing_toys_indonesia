'use strict';

const { IOdooProductRepository } = require('../../domain/repositories/IOdooProductRepository');

/**
 * Mandatory product field values written to Odoo on every sync.
 * Centralised here so the single source of truth is never split across callers.
 *
 * type = 'consu' is the internal API value for storable/goods products in all
 * supported Odoo versions (16/17/18). The Odoo UI labels this as "Goods".
 * is_storable = true elevates a consumable to a fully tracked storable product.
 */
const REQUIRED_PRODUCT_FIELDS = Object.freeze({
  type:           'consu',
  invoice_policy: 'order',
  is_storable:    true,
});

/**
 * All write operations against Odoo product.template flow through here.
 *
 * Responsibilities:
 *  • ensureProductFields  — enforce type / invoice_policy / is_storable on product.template
 *  • applyStockAdjustment — full stock.quant resolve → action_apply_inventory pipeline
 *  • readCurrentQty       — confirm qty_available after adjustment
 *  • postNote             — post internal chatter note
 *
 * Reads delegate to OdooProductAdapter (no duplication).
 * Stock operations delegate to OdooStockAdapter (complex quant flow lives there).
 *
 * @implements {IOdooProductRepository}
 */
class OdooProductRepository extends IOdooProductRepository {
  /**
   * @param {object} deps
   * @param {import('../http/OdooHttpClient').OdooHttpClient}           deps.httpClient
   * @param {import('./OdooProductAdapter').OdooProductAdapter}         deps.productAdapter
   * @param {import('./OdooStockAdapter').OdooStockAdapter}             deps.stockAdapter
   * @param {import('./OdooChatterAdapter').OdooChatterAdapter}         deps.chatterAdapter
   */
  constructor({ httpClient, productAdapter, stockAdapter, chatterAdapter }) {
    super();
    this._http    = httpClient;
    this._product = productAdapter;
    this._stock   = stockAdapter;
    this._chatter = chatterAdapter;
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Write type=goods, invoice_policy=order, is_storable=true to product.template.
   * Called before every stock adjustment — enforces correct product configuration
   * instead of gating on it.
   *
   * @param {number} templateId
   */
  async ensureProductFields(templateId) {
    await this._http.callKw(
      'product.template', 'write',
      [[templateId], REQUIRED_PRODUCT_FIELDS]
    );
  }

  /**
   * Full stock adjustment pipeline:
   *   1. Resolve (or create) stock.quant for the product's WH/Stock location.
   *   2. Ensure property_stock_inventory is set so action_apply_inventory can
   *      create the stock.move with the correct virtual location.
   *   3. Write inventory_quantity + call action_apply_inventory (absolute / idempotent).
   *
   * @param {number} templateId
   * @param {number} qty  — target absolute on-hand quantity
   * @returns {Promise<{quantId: number, qtyBefore: number, locationId: number, variantId: number}>}
   */
  async applyStockAdjustment(templateId, qty) {
    const { quantId, qtyBefore, locationId, variantId } =
      await this._stock.resolveQuant(templateId);
    await this._stock.applyInventoryAdjustment(quantId, variantId, qty);
    return { quantId, qtyBefore, locationId, variantId };
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /**
   * Read qty_available (computed) from product.template to confirm the adjustment landed.
   *
   * @param {number} templateId
   * @returns {Promise<number|null>}
   */
  async readCurrentQty(templateId) {
    return this._product.readCurrentQty(templateId);
  }

  // ── Chatter ─────────────────────────────────────────────────────────────────

  /** @param {number} templateId  @param {object} note */
  async postNote(templateId, note) {
    return this._chatter.postNote(templateId, note);
  }
}

module.exports = { OdooProductRepository, REQUIRED_PRODUCT_FIELDS };
