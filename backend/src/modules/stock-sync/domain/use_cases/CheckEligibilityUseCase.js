'use strict';

const { EligibilityResult, ELIGIBILITY } = require('../entities/EligibilityResult');

/**
 * Checks whether an Odoo product.template is eligible for stock sync.
 *
 * Three rules must ALL pass:
 *   RULE 1: type == 'consu'        (consumable/storable in Odoo 16+)
 *   RULE 2: invoice_policy == 'order'
 *   RULE 3: is_storable == true    (explicit storable flag in Odoo 16+)
 */
class CheckEligibilityUseCase {
  /**
   * @param {import('../../infrastructure/odoo/OdooProductAdapter').OdooProductAdapter} odooProductAdapter
   */
  constructor(odooProductAdapter) {
    this._odooProduct = odooProductAdapter;
  }

  /**
   * @param {import('../entities/Product').Product} product
   * @returns {Promise<EligibilityResult>}
   */
  async execute(product) {
    if (!product.odooProductId) {
      return EligibilityResult.fail(
        product.productId, null,
        ELIGIBILITY.UNMAPPED,
        'No Odoo product mapping found in integration_xref.'
      );
    }

    const fields = await this._odooProduct.readEligibilityFields(product.odooProductId);

    if (fields.type !== 'consu') {
      return EligibilityResult.fail(
        product.productId, product.odooProductId,
        ELIGIBILITY.FAIL_TYPE,
        `Product type is '${fields.type}'; expected 'consu'.`
      );
    }
    if (fields.invoice_policy !== 'order') {
      return EligibilityResult.fail(
        product.productId, product.odooProductId,
        ELIGIBILITY.FAIL_POLICY,
        `Invoice policy is '${fields.invoice_policy}'; expected 'order'.`
      );
    }
    if (!fields.is_storable) {
      return EligibilityResult.fail(
        product.productId, product.odooProductId,
        ELIGIBILITY.FAIL_STORABLE,
        'is_storable is false; product is not a storable product in Odoo.'
      );
    }

    return EligibilityResult.pass(product.productId, product.odooProductId);
  }
}

module.exports = { CheckEligibilityUseCase };
