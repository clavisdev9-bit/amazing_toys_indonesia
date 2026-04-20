'use strict';

/** @enum {string} */
const ELIGIBILITY = Object.freeze({
  PASS:          'pass',
  FAIL_TYPE:     'fail_type',       // product.type != 'consu'
  FAIL_POLICY:   'fail_policy',     // invoice_policy != 'order'
  FAIL_STORABLE: 'fail_storable',   // is_storable != true
  UNMAPPED:      'unmapped',        // no odoo_product_id in integration_xref
});

class EligibilityResult {
  /**
   * @param {object}      props
   * @param {string}      props.productId
   * @param {number|null} props.odooProductId
   * @param {string}      props.rule          — one of ELIGIBILITY values
   * @param {boolean}     props.eligible
   * @param {string|null} [props.reason]
   */
  constructor({ productId, odooProductId, rule, eligible, reason = null }) {
    this.productId     = productId;
    this.odooProductId = odooProductId ?? null;
    this.rule          = rule;
    this.eligible      = eligible;
    this.reason        = reason;
  }

  static pass(productId, odooProductId) {
    return new EligibilityResult({
      productId, odooProductId, rule: ELIGIBILITY.PASS, eligible: true,
    });
  }

  static fail(productId, odooProductId, rule, reason) {
    return new EligibilityResult({
      productId, odooProductId, rule, eligible: false, reason,
    });
  }
}

module.exports = { EligibilityResult, ELIGIBILITY };
