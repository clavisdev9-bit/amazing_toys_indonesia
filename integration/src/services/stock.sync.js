'use strict';

const odoo = require('../clients/odoo.client');
const sos = require('../clients/sos.client');
const audit = require('../utils/audit');
const cb = require('../utils/circuit.breaker');
const { deriveStockStatus } = require('../utils/stock_utils');
const logger = require('../config/logger');
const { query } = require('../config/database');

/**
 * FR-007: Sync Odoo qty_available → SOS stock_quantity for all known xref products.
 * Only storable products (type='product') carry meaningful stock quantities in Odoo.
 */
async function syncStock() {
  if (cb.isOpen('odoo') || cb.isOpen('sos')) {
    logger.warn('Stock sync skipped: circuit breaker open');
    return;
  }

  logger.info('Stock sync: starting');

  // Load all product xrefs that have a sos_product_id in metadata.
  const xrefRows = await query(
    `SELECT sos_id, odoo_id, sync_metadata
     FROM integration_xref
     WHERE entity_type = 'product' AND status = 'ACTIVE'`
  );

  if (xrefRows.rows.length === 0) {
    logger.info('Stock sync: no product xrefs found — run product sync first');
    return;
  }

  // sos_id stores the Odoo product.product ID (as a string) — see product.sync.js.
  // Query product.product (not product.template) so the IDs match.
  // Filter to storable products only; service products always report qty=0.
  const odooProductIds = xrefRows.rows.map(r => parseInt(r.sos_id, 10)).filter(Boolean);

  let odooProducts;
  try {
    odooProducts = await odoo.searchRead(
      'product.product',
      [['id', 'in', odooProductIds], ['type', '=', 'consu']],
      ['id', 'qty_available']
    );
    cb.recordSuccess('odoo');
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('Stock sync: failed to fetch Odoo stock', { error: err.message });
    return;
  }

  const qtyMap = {};
  for (const p of odooProducts) qtyMap[p.id] = Math.max(0, Math.floor(p.qty_available));

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of xrefRows.rows) {
    const odooProductId = parseInt(row.sos_id, 10);
    const meta = row.sync_metadata || {};
    const sosProductId = meta.sos_product_id;

    if (!sosProductId) continue;

    const newQty = qtyMap[odooProductId];
    if (newQty === undefined) continue; // product is not storable — skip

    const newStatus = deriveStockStatus(newQty);

    if (meta.last_stock_qty === newQty) {
      skipped++;
      continue;
    }

    try {
      await sos.patch(`/products/${sosProductId}`, {
        stock_quantity: newQty,
        stock_status: newStatus,
      });
      cb.recordSuccess('sos');

      await query(
        `UPDATE integration_xref
            SET sync_metadata = sync_metadata || $1, updated_at = NOW()
          WHERE entity_type = 'product' AND sos_id = $2`,
        [JSON.stringify({ last_stock_qty: newQty }), row.sos_id]
      );

      updated++;
      audit.log({
        operation_type: 'STOCK_SYNC',
        entity_type: 'product',
        sos_entity_id: sosProductId,
        odoo_entity_id: odooProductId,
        action: 'UPDATE',
        status: 'SUCCESS',
      });
    } catch (err) {
      cb.recordFailure('sos');
      failed++;
      logger.error('Stock sync: product update failed', { sosProductId, error: err.message });
      audit.log({
        operation_type: 'STOCK_SYNC',
        entity_type: 'product',
        sos_entity_id: sosProductId,
        odoo_entity_id: odooProductId,
        action: 'FAIL',
        status: 'FAILED',
        error_message: err.message,
      });
    }
  }

  logger.info('Stock sync: complete', { updated, skipped, failed });
}

module.exports = { syncStock };
