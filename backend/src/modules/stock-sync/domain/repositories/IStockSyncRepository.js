'use strict';

/**
 * Interface: persistence contract for StockSyncRecord.
 * Concrete implementation lives in /infrastructure/persistence.
 */
class IStockSyncRepository {
  /**
   * Persist a sync record (insert or update by syncId).
   * @param {import('../entities/StockSyncRecord').StockSyncRecord} record
   * @returns {Promise<void>}
   */
  async save(record) { throw new Error('IStockSyncRepository.save() not implemented.'); }

  /**
   * Return paginated sync records, optionally filtered by productId.
   * @param {object}  opts
   * @param {string}  [opts.productId]
   * @param {number}  [opts.limit]
   * @param {number}  [opts.offset]
   * @returns {Promise<{records: StockSyncRecord[], total: number}>}
   */
  async findByProduct(opts) { throw new Error('IStockSyncRepository.findByProduct() not implemented.'); }

  /**
   * Aggregate stats for a given triggeredBy since a timestamp.
   * @param {string} triggeredBy
   * @param {Date}   since
   * @returns {Promise<{total: number, success: number, failed: number}>}
   */
  async getStats(triggeredBy, since) { throw new Error('IStockSyncRepository.getStats() not implemented.'); }
}

module.exports = { IStockSyncRepository };
