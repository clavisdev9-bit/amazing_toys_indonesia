'use strict';

const odoo = require('../clients/odoo.client');
const sos = require('../clients/sos.client');
const audit = require('../utils/audit');
const cb = require('../utils/circuit.breaker');
const logger = require('../config/logger');
const env = require('../config/env');
const { query } = require('../config/database');

function deriveStockStatus(qty) {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= env.LOW_STOCK_THRESHOLD) return 'LOW_STOCK';
  return 'AVAILABLE';
}

/**
 * FR-007: Sync Odoo qty_available → SOS stock_quantity for all known xref products.
 */
async function syncStock() {
  if (cb.isOpen('odoo') || cb.isOpen('sos')) {
    logger.warn('Stock sync skipped: circuit breaker open');
    return;
  }

  logger.info('Stock sync: starting');

  // Load all product xrefs with sos_product_id in metadata
  const xrefRows = await query(
    `SELECT sos_id, odoo_id, sync_metadata FROM integration_xref WHERE entity_type = 'product' AND status = 'ACTIVE'`
  );

  if (xrefRows.rows.length === 0) {
    logger.info('Stock sync: no product xrefs found — run product sync first');
    return;
  }

  // Batch fetch Odoo qty_available
  const odooIds = xrefRows.rows.map(r => parseInt(r.sos_id, 10)).filter(Boolean);
  let odooProducts;
  try {
    odooProducts = await odoo.searchRead('product.template', [['id', 'in', odooIds]], ['id', 'qty_available']);
    cb.recordSuccess('odoo');
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('Stock sync: failed to fetch Odoo stock', { error: err.message });
    return;
  }

  const qtyMap = {};
  for (const p of odooProducts) qtyMap[p.id] = Math.max(0, Math.floor(p.qty_available));

  let updated = 0, skipped = 0, failed = 0;

  for (const row of xrefRows.rows) {
    const odooId = parseInt(row.sos_id, 10);
    const meta = row.sync_metadata || {};
    const sosProductId = meta.sos_product_id;
    if (!sosProductId) continue;

    const newQty = qtyMap[odooId];
    if (newQty === undefined) continue;

    const newStatus = deriveStockStatus(newQty);

    // Skip if unchanged (compare against last known)
    if (meta.last_stock_qty === newQty) {
      skipped++;
      continue;
    }

    try {
      await sos.patch(`/products/${sosProductId}`, { stock_quantity: newQty, stock_status: newStatus });
      cb.recordSuccess('sos');

      // Update sync_metadata with last known stock
      await query(
        `UPDATE integration_xref SET sync_metadata = sync_metadata || $1, updated_at = NOW()
         WHERE entity_type = 'product' AND sos_id = $2`,
        [JSON.stringify({ last_stock_qty: newQty }), row.sos_id]
      );

      updated++;
      audit.log({ operation_type: 'STOCK_SYNC', entity_type: 'product', sos_entity_id: sosProductId, odoo_entity_id: odooId, action: 'UPDATE', status: 'SUCCESS' });
    } catch (err) {
      cb.recordFailure('sos');
      failed++;
      logger.error('Stock sync: product update failed', { sosProductId, error: err.message });
      audit.log({ operation_type: 'STOCK_SYNC', entity_type: 'product', sos_entity_id: sosProductId, odoo_entity_id: odooId, action: 'FAIL', status: 'FAILED', error_message: err.message });
    }
  }

  logger.info('Stock sync: complete', { updated, skipped, failed });
}

module.exports = { syncStock };
