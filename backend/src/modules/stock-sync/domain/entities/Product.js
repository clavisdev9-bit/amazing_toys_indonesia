'use strict';

/**
 * Lightweight domain entity for a SOS product, used in stock sync.
 */
class Product {
  /**
   * @param {object}      props
   * @param {string}      props.productId
   * @param {string}      props.productName
   * @param {number}      props.stockQuantity
   * @param {string|null} props.barcode
   * @param {number|null} props.odooCategId
   * @param {number|null} props.odooProductId  — product.template ID from integration_xref
   */
  constructor({ productId, productName, stockQuantity, barcode, odooCategId, odooProductId }) {
    this.productId     = productId;
    this.productName   = productName;
    this.stockQuantity = Number(stockQuantity);
    this.barcode       = barcode      ?? null;
    this.odooCategId   = odooCategId  ?? null;
    this.odooProductId = odooProductId ?? null;
  }
}

module.exports = { Product };
