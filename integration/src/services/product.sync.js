'use strict';

const odoo = require('../clients/odoo.client');
const sos = require('../clients/sos.client');
const xref = require('../utils/xref');
const audit = require('../utils/audit');
const cb = require('../utils/circuit.breaker');
const { deriveStockStatus } = require('../utils/stock_utils');
const logger = require('../config/logger');
const env = require('../config/env');
const { query } = require('../config/database');

function resolveTenantId(catName) {
  if (!catName) return env.DEFAULT_TENANT_ID;
  const key = Object.keys(env.TENANT_PRODUCT_MAPPING).find(k =>
    catName.toLowerCase().includes(k.toLowerCase())
  );
  return key ? env.TENANT_PRODUCT_MAPPING[key] : env.DEFAULT_TENANT_ID;
}

/**
 * FR-002: Sync Odoo product catalogue → SOS.
 *
 * - Active Odoo products are created or updated in SOS.
 * - Products previously synced but no longer active in Odoo are archived in SOS
 *   (active=false sent via PATCH — records are never deleted from either system).
 */
async function syncProducts() {
  if (cb.isOpen('sos') || cb.isOpen('odoo')) {
    logger.warn('Product sync skipped: circuit breaker open');
    return;
  }

  const startAt = Date.now();
  logger.info('Product sync: starting');
  const stats = { processed: 0, created: 0, updated: 0, skipped: 0, archived: 0, failed: 0 };

  // ── Build booth→tenant map from integration_xref ─────────────────────────────
  const boothToTenant = {};
  try {
    const tenantRows = await query(
      `SELECT sos_id, odoo_id FROM integration_xref WHERE entity_type = 'tenant' AND status = 'ACTIVE'`
    );
    for (const row of tenantRows.rows) {
      boothToTenant[String(row.odoo_id)] = row.sos_id;
    }
    logger.info('Product sync: loaded tenant xref map', { count: Object.keys(boothToTenant).length });
  } catch (err) {
    logger.warn('Product sync: could not load tenant xref map', { error: err.message });
  }

  // ── Fetch all active, saleable products from Odoo ────────────────────────────
  let odooProducts;
  try {
    odooProducts = await odoo.searchRead(
      'product.product',
      [['active', '=', true], ['sale_ok', '=', true]],
      ['id', 'name', 'barcode', 'list_price', 'categ_id', 'qty_available', 'default_code', 'x_studio_booth']
    );
    cb.recordSuccess('odoo');
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('Product sync: failed to fetch Odoo products', { error: err.message });
    return;
  }

  const activeOdooIds = new Set(odooProducts.map(p => String(p.id)));

  // ── Create / update ──────────────────────────────────────────────────────────
  for (const op of odooProducts) {
    stats.processed++;

    if (!op.barcode) {
      stats.skipped++;
      logger.warn('Product sync: skipping product without barcode', { odoo_id: op.id, name: op.name });
      audit.log({
        operation_type: 'PRODUCT_SYNC',
        entity_type: 'product',
        odoo_entity_id: op.id,
        action: 'SKIP',
        status: 'SUCCESS',
        request_summary: `No barcode: ${op.name}`,
      });
      continue;
    }

    const price = Math.round(op.list_price);
    const stockQty = Math.max(0, Math.floor(op.qty_available));
    const stockStatus = deriveStockStatus(stockQty);
    const catName = Array.isArray(op.categ_id) ? op.categ_id[1] : (op.categ_id?.name || '');
    // x_studio_booth is Many2one: [id, name] or false
    const boothOdooId = Array.isArray(op.x_studio_booth) ? String(op.x_studio_booth[0]) : null;
    const tenantIdFromBooth = boothOdooId ? (boothToTenant[boothOdooId] || null) : null;
    const tenantId = tenantIdFromBooth || resolveTenantId(catName);

    try {
      let sosProduct;
      try {
        sosProduct = await sos.get(`/products/barcode/${encodeURIComponent(op.barcode)}`);
        cb.recordSuccess('sos');
      } catch (err) {
        if (err.response?.status === 404) {
          sosProduct = null;
        } else {
          cb.recordFailure('sos');
          throw err;
        }
      }

      if (!sosProduct) {
        // ── Create in SOS ──
        const created = await sos.post('/products', {
          product_id: `P${op.id}-${tenantId}`,
          product_name: op.name,
          category: catName,
          price,
          stock_quantity: stockQty,
          stock_status: stockStatus,
          barcode: op.barcode,
          tenant_id: tenantId,
        });
        const sosId = (created.data || created).product_id;
        await xref.upsertXref('product', String(op.id), op.id, {
          sos_product_id: sosId,
          barcode: op.barcode,
        });
        stats.created++;
        audit.log({
          operation_type: 'PRODUCT_SYNC',
          entity_type: 'product',
          sos_entity_id: sosId,
          odoo_entity_id: op.id,
          action: 'CREATE',
          status: 'SUCCESS',
        });
      } else {
        // ── Update price + stock_quantity + tenant from Odoo ──
        const p = sosProduct.data || sosProduct;
        const sosId = p.product_id;
        const priceChanged = Number(p.price) !== price;
        const stockChanged = Number(p.stock_quantity) !== stockQty;
        const tenantChanged = tenantIdFromBooth && String(p.tenant_id) !== String(tenantIdFromBooth);

        if (priceChanged || stockChanged || tenantChanged) {
          const patch = {};
          if (priceChanged) patch.price = price;
          if (stockChanged) { patch.stock_quantity = stockQty; patch.stock_status = stockStatus; }
          if (tenantChanged) patch.tenant_id = tenantIdFromBooth;
          await sos.patch(`/products/${sosId}`, patch);
          stats.updated++;
          audit.log({
            operation_type: 'PRODUCT_SYNC',
            entity_type: 'product',
            sos_entity_id: String(sosId),
            odoo_entity_id: op.id,
            action: 'UPDATE',
            status: 'SUCCESS',
            request_summary: `price=${priceChanged} stock=${stockChanged} tenant=${!!tenantChanged}`,
          });
        } else {
          stats.skipped++;
          audit.log({
            operation_type: 'PRODUCT_SYNC',
            entity_type: 'product',
            sos_entity_id: String(sosId),
            odoo_entity_id: op.id,
            action: 'SKIP',
            status: 'SUCCESS',
          });
        }
        await xref.upsertXref('product', String(op.id), op.id, {
          sos_product_id: String(sosId),
          barcode: op.barcode,
        });
      }
    } catch (err) {
      stats.failed++;
      logger.error('Product sync: product failed', { odoo_id: op.id, name: op.name, error: err.message });
      audit.log({
        operation_type: 'PRODUCT_SYNC',
        entity_type: 'product',
        odoo_entity_id: op.id,
        action: 'FAIL',
        status: 'FAILED',
        error_message: err.message,
      });
    }
  }

  // ── Archive sweep: products removed from Odoo must be archived in SOS ───────
  // Never delete — set active=false so SOS hides them from sale.
  try {
    const allXrefRows = await query(
      `SELECT sos_id, sync_metadata
       FROM integration_xref
       WHERE entity_type = 'product' AND status = 'ACTIVE'`
    );

    for (const row of allXrefRows.rows) {
      if (activeOdooIds.has(row.sos_id)) continue; // still active in Odoo

      const meta = row.sync_metadata || {};
      const sosProductId = meta.sos_product_id;
      if (!sosProductId) continue;

      try {
        await sos.patch(`/products/${sosProductId}`, { active: false, stock_quantity: 0, stock_status: 'OUT_OF_STOCK' });
        await query(
          `UPDATE integration_xref SET status = 'CANCELLED', updated_at = NOW()
           WHERE entity_type = 'product' AND sos_id = $1`,
          [row.sos_id]
        );
        stats.archived++;
        audit.log({
          operation_type: 'PRODUCT_SYNC',
          entity_type: 'product',
          sos_entity_id: String(sosProductId),
          odoo_entity_id: parseInt(row.sos_id, 10),
          action: 'UPDATE',
          status: 'SUCCESS',
          request_summary: 'Archived: product inactive or removed in Odoo',
        });
        logger.info('Product sync: archived SOS product (inactive in Odoo)', {
          sos_id: row.sos_id,
          sosProductId,
        });
      } catch (err) {
        logger.error('Product sync: failed to archive SOS product', {
          sos_id: row.sos_id,
          sosProductId,
          error: err.message,
        });
      }
    }
  } catch (err) {
    logger.error('Product sync: archive sweep failed', { error: err.message });
  }

  logger.info('Product sync: complete', { ...stats, durationMs: Date.now() - startAt });
}

module.exports = { syncProducts };
