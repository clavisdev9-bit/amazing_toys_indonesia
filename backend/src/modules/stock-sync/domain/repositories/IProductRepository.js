'use strict';

/**
 * Interface: read-only access to SOS product data for stock sync.
 * Concrete implementation lives in /infrastructure/persistence.
 */
class IProductRepository {
  /**
   * Return all active SOS products with their Odoo xref IDs.
   * @returns {Promise<Array<import('../entities/Product').Product>>}
   */
  async findAllActive() { throw new Error('IProductRepository.findAllActive() not implemented.'); }

  /**
   * Return one product by its SOS product_id, or null if not found.
   * @param {string} productId
   * @returns {Promise<import('../entities/Product').Product|null>}
   */
  async findById(productId) { throw new Error('IProductRepository.findById() not implemented.'); }
}

module.exports = { IProductRepository };
