'use strict';

class SyncResultDTO {
  constructor({ batchId, total, success, failed, skipped, records, steps, syncedAt }) {
    this.batchId  = batchId;
    this.total    = total;
    this.success  = success;
    this.failed   = failed;
    this.skipped  = skipped;
    this.records  = records;
    this.steps    = steps;
    this.syncedAt = syncedAt;
  }

  /**
   * @param {import('../../domain/entities/SyncBatch').SyncBatch} batch
   * @returns {SyncResultDTO}
   */
  static fromBatch(batch) {
    return new SyncResultDTO({
      batchId:  batch.batchId,
      total:    batch.total,
      success:  batch.success,
      failed:   batch.failed,
      skipped:  batch.skipped,
      syncedAt: batch.triggeredAt.toISOString(),
      steps: (batch.steps ?? []).map(s => ({
        step:       s.name,
        status:     s.status,
        count:      s.count,
        startedAt:  s.startedAt?.toISOString() ?? null,
        durationMs: s.durationMs ?? null,
        error:      s.error ?? null,
      })),
      records: batch.records.map(r => ({
        syncId:          r.syncId,
        productId:       r.productId,
        odooProductId:   r.odooProductId,
        qtyBefore:       r.qtyBefore,
        qtySent:         r.qtySent,
        qtyConfirmed:    r.qtyConfirmed,
        eligibilityRule: r.eligibilityRule,
        status:          r.status,
        errorCode:       r.errorCode,
        errorMessage:    r.errorMessage,
        durationMs:      r.durationMs,
      })),
    });
  }
}

module.exports = { SyncResultDTO };
