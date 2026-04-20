'use strict';

class SyncMapper {
  static toSyncRequest(req) {
    return {
      triggeredBy: req.user?.user_id ?? 'admin',
      productIds:  Array.isArray(req.body?.product_ids) ? req.body.product_ids : null,
    };
  }

  /**
   * Flat response shape (200 or 207).
   * Includes etl_steps[] always; errors[] only when failed > 0.
   *
   * @param {import('../../application/dtos/SyncResultDTO').SyncResultDTO} dto
   * @param {number} durationMs
   */
  static toSyncToOdooResponse(dto, durationMs) {
    const base = {
      batch_id:    dto.batchId,
      total:       dto.total,
      synced:      dto.success,
      skipped:     dto.skipped,
      failed:      dto.failed,
      duration_ms: durationMs,
      etl_steps:   (dto.steps ?? []).map(s => ({
        step:        s.step,
        status:      s.status,
        count:       s.count,
        duration_ms: s.durationMs,
      })),
    };

    if (dto.failed > 0) {
      base.errors = dto.records
        .filter(r => r.status === 'failed')
        .map(r => ({ product_id: r.productId, reason: r.errorMessage ?? r.errorCode ?? 'unknown' }));
    }

    return base;
  }

  static toHistoryResponse({ records, total }) {
    return {
      success: true,
      data: {
        items: records.map(r => ({
          sync_id:          r.syncId,
          batch_id:         r.batchId,
          triggered_by:     r.triggeredBy,
          triggered_at:     r.triggeredAt,
          product_id:       r.productId,
          odoo_product_id:  r.odooProductId,
          qty_before:       r.qtyBefore,
          qty_sent:         r.qtySent,
          qty_confirmed:    r.qtyConfirmed,
          eligibility_rule: r.eligibilityRule,
          status:           r.status,
          error_code:       r.errorCode,
          error_message:    r.errorMessage,
          duration_ms:      r.durationMs,
        })),
        total,
      },
    };
  }
}

module.exports = { SyncMapper };
