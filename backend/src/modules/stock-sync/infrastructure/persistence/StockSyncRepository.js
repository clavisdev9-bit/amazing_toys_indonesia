'use strict';

const { IStockSyncRepository } = require('../../domain/repositories/IStockSyncRepository');
const { StockSyncRecord }       = require('../../domain/entities/StockSyncRecord');

const INSERT_SQL = `
  INSERT INTO stock_sync_log
    (sync_id, batch_id, triggered_by, triggered_at, direction,
     sos_product_id, odoo_product_id, odoo_quant_id, location_id,
     qty_before, qty_sent, qty_confirmed, eligibility_rule,
     status, error_code, error_message, odoo_response, duration_ms)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
  ON CONFLICT (sync_id) DO UPDATE SET
    status           = EXCLUDED.status,
    odoo_quant_id    = EXCLUDED.odoo_quant_id,
    location_id      = EXCLUDED.location_id,
    qty_before       = EXCLUDED.qty_before,
    qty_confirmed    = EXCLUDED.qty_confirmed,
    eligibility_rule = EXCLUDED.eligibility_rule,
    error_code       = EXCLUDED.error_code,
    error_message    = EXCLUDED.error_message,
    odoo_response    = EXCLUDED.odoo_response,
    duration_ms      = EXCLUDED.duration_ms`;

/** @implements {IStockSyncRepository} */
class StockSyncRepository extends IStockSyncRepository {
  /** @param {{ query: Function }} db */
  constructor(db) {
    super();
    this._db = db;
  }

  /** @param {import('../../domain/entities/StockSyncRecord').StockSyncRecord} record */
  _toParams(record) {
    return [
      record.syncId,
      record.batchId,
      record.triggeredBy,
      record.triggeredAt,
      record.direction,
      record.productId,
      record.odooProductId,
      record.odooQuantId,
      record.locationId,
      record.qtyBefore,
      record.qtySent,
      record.qtyConfirmed,
      record.eligibilityRule,
      record.status,
      record.errorCode,
      record.errorMessage,
      record.odooResponse ? JSON.stringify(record.odooResponse) : null,
      record.durationMs,
    ];
  }

  /** @override */
  async save(record) {
    await this._db.query(INSERT_SQL, this._toParams(record));
  }

  /**
   * Atomically insert (or upsert) all records in a single DB transaction.
   * Either every row lands or the whole batch is rolled back.
   *
   * @param {import('../../domain/entities/StockSyncRecord').StockSyncRecord[]} records
   */
  async saveAll(records) {
    await this._db.withTransaction(async (client) => {
      for (const record of records) {
        await client.query(INSERT_SQL, this._toParams(record));
      }
    });
  }

  /**
   * Remove PENDING records for a given batchId so a retry run starts clean.
   * On first run this is a no-op.
   *
   * @param {string} batchId
   */
  async deletePendingByBatch(batchId) {
    await this._db.query(
      "DELETE FROM stock_sync_log WHERE batch_id = $1 AND status = 'pending'",
      [batchId]
    );
  }

  /** @override */
  async findByProduct({ productId, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const params     = [];

    if (productId) {
      params.push(productId);
      conditions.push(`s.sos_product_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const sql = `
      SELECT s.sync_id, s.batch_id, s.triggered_by, s.triggered_at, s.direction,
             s.sos_product_id, p.product_name,
             s.odoo_product_id, s.odoo_quant_id, s.location_id,
             s.qty_before, s.qty_sent, s.qty_confirmed, s.eligibility_rule,
             s.status, s.error_code, s.error_message, s.odoo_response, s.duration_ms,
             s.created_at
      FROM   stock_sync_log s
      JOIN   products p ON p.product_id = s.sos_product_id
      ${where}
      ORDER  BY s.created_at DESC
      LIMIT  $${params.length - 1} OFFSET $${params.length}
    `;
    const countSql = `SELECT COUNT(*) FROM stock_sync_log s ${where}`;

    const [data, count] = await Promise.all([
      this._db.query(sql, params),
      this._db.query(countSql, params.slice(0, -2)),
    ]);

    const records = data.rows.map(r => new StockSyncRecord({
      syncId:          r.sync_id,
      batchId:         r.batch_id,
      triggeredBy:     r.triggered_by,
      triggeredAt:     r.triggered_at,
      productId:       r.sos_product_id,
      odooProductId:   r.odoo_product_id,
      odooQuantId:     r.odoo_quant_id,
      locationId:      r.location_id,
      qtyBefore:       r.qty_before   != null ? Number(r.qty_before)   : null,
      qtySent:         Number(r.qty_sent),
      qtyConfirmed:    r.qty_confirmed != null ? Number(r.qty_confirmed) : null,
      eligibilityRule: r.eligibility_rule,
      status:          r.status,
      errorCode:       r.error_code,
      errorMessage:    r.error_message,
      odooResponse:    r.odoo_response,
      durationMs:      r.duration_ms,
    }));

    return { records, total: parseInt(count.rows[0].count, 10) };
  }

  /** @override */
  async getStats(batchId) {
    const result = await this._db.query(
      `SELECT
         COUNT(*)                                    AS total,
         COUNT(*) FILTER (WHERE status = 'success') AS success,
         COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
         COUNT(*) FILTER (WHERE status = 'skipped') AS skipped
       FROM stock_sync_log
       WHERE batch_id = $1`,
      [batchId]
    );
    const row = result.rows[0];
    return {
      total:   parseInt(row.total,   10),
      success: parseInt(row.success, 10),
      failed:  parseInt(row.failed,  10),
      skipped: parseInt(row.skipped, 10),
    };
  }
}

module.exports = { StockSyncRepository };
