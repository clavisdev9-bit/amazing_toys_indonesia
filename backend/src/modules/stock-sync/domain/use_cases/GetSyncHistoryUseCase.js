'use strict';

const { Result } = require('../value_objects/Result');

/**
 * Read-side use case: retrieve paginated stock sync history.
 */
class GetSyncHistoryUseCase {
  /**
   * @param {import('../repositories/IStockSyncRepository').IStockSyncRepository} syncRepo
   */
  constructor(syncRepo) {
    this._syncRepo = syncRepo;
  }

  /**
   * @param {object} query
   * @param {string} [query.productId]
   * @param {number} [query.limit]
   * @param {number} [query.offset]
   * @returns {Promise<Result<{records, total}>>}
   */
  async execute({ productId, limit = 50, offset = 0 } = {}) {
    const data = await this._syncRepo.findByProduct({ productId, limit, offset });
    return Result.ok(data);
  }
}

module.exports = { GetSyncHistoryUseCase };
