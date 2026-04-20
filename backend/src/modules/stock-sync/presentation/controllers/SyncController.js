'use strict';

const { StockSyncService } = require('../../application/services/StockSyncService');
const { SyncMapper }       = require('../mappers/SyncMapper');

const syncService = new StockSyncService();

/**
 * POST /api/v1/admin/stock-sync
 * Trigger a full (or selective) stock sync from SOS → Odoo.
 * Body: { product_ids?: string[] }
 *
 * 200 — all products synced successfully
 * 207 — partial: at least one product failed or was skipped
 * 500 — service-level failure
 */
async function syncToOdoo(req, res, next) {
  const startMs = Date.now();
  try {
    const request = SyncMapper.toSyncRequest(req);
    const dto     = await syncService.syncStock(request);
    const durationMs = Date.now() - startMs;

    const hasErrors = dto.failed > 0;
    const status    = hasErrors ? 207 : 200;

    res.status(status).json(SyncMapper.toSyncToOdooResponse(dto, durationMs));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/stock-sync/history
 * Retrieve paginated stock sync audit log.
 * Query: product_id?, limit?, offset?
 */
async function getSyncHistory(req, res, next) {
  try {
    const result = await syncService.getSyncHistory({
      productId: req.query.product_id  || undefined,
      limit:     parseInt(req.query.limit  || '50', 10),
      offset:    parseInt(req.query.offset || '0',  10),
    });
    res.json(SyncMapper.toHistoryResponse(result));
  } catch (err) {
    next(err);
  }
}

module.exports = { syncToOdoo, getSyncHistory };
