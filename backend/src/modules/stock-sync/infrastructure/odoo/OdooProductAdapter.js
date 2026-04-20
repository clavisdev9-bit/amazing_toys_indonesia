'use strict';

/**
 * Odoo adapter for product.template read operations used in stock sync.
 */
class OdooProductAdapter {
  /**
   * @param {import('../http/OdooHttpClient').OdooHttpClient} httpClient
   */
  constructor(httpClient) {
    this._http = httpClient;
  }

  /**
   * Read the three eligibility fields from product.template.
   *
   * @param {number} templateId
   * @returns {Promise<{type: string, invoice_policy: string, is_storable: boolean}>}
   */
  async readEligibilityFields(templateId) {
    const rows = await this._http.callKw(
      'product.template', 'read',
      [[templateId]],
      { fields: ['type', 'invoice_policy', 'is_storable'] }
    );
    if (!rows?.length) {
      throw Object.assign(
        new Error(`product.template ${templateId} not found in Odoo.`),
        { code: 'ODOO_NOT_FOUND' }
      );
    }
    return rows[0];
  }

  /**
   * Read the current qty_available (computed) from product.template.
   * Used after stock.quant adjustment to confirm the new on-hand quantity.
   *
   * @param {number} templateId
   * @returns {Promise<number>}
   */
  async readCurrentQty(templateId) {
    const rows = await this._http.callKw(
      'product.template', 'read',
      [[templateId]],
      { fields: ['qty_available'] }
    );
    return rows?.[0]?.qty_available ?? null;
  }
}

module.exports = { OdooProductAdapter };
