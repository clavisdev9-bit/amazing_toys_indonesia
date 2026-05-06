'use strict';

// SOS → Odoo product push.
// Mirrors admin.service.js syncOdooProducts() but uses this service's
// axios-based odoo.client instead of the backend's native-fetch copy.

const odoo = require('../clients/odoo.client');
const { query } = require('../config/database');
const logger = require('../config/logger');

let _syncInProgress = false;

function buildProductVals(p) {
  return {
    name:           p.product_name,
    list_price:     Number(p.price),
    sale_ok:        true,
    active:         true,
    type:           'consu',
    invoice_policy: 'order',
    route_ids:      [[5, 0, 0]],
    ...(p.odoo_categ_id ? { categ_id: p.odoo_categ_id } : {}),
  };
}

function isBarcodeConflict(err) {
  return /barcode/i.test(err.message) && /already/i.test(err.message);
}

function isCategMissing(err) {
  return err.message.includes('product.category') && err.message.includes('does not exist');
}

async function writeVariantBarcode(templateId, barcode) {
  if (!barcode) return;
  const tmpl = await odoo.callKw('product.template', 'read', [[templateId]], { fields: ['product_variant_ids'] });
  const variantId = tmpl?.[0]?.product_variant_ids?.[0];
  if (!variantId) return;
  try {
    await odoo.callKw('product.product', 'write', [[variantId], { barcode }]);
  } catch (err) {
    if (!isBarcodeConflict(err)) throw err;
    // barcode already on another variant — skip silently
  }
}

async function upsertXref(sosId, odooId, barcode) {
  await query(
    `DELETE FROM integration_xref WHERE entity_type='product' AND odoo_id=$1 AND sos_id<>$2`,
    [odooId, sosId]
  );
  await query(
    `INSERT INTO integration_xref (entity_type, sos_id, odoo_id, status, sync_metadata)
     VALUES ('product', $1, $2, 'ACTIVE', $3)
     ON CONFLICT (entity_type, sos_id)
     DO UPDATE SET odoo_id=EXCLUDED.odoo_id, sync_metadata=EXCLUDED.sync_metadata, updated_at=NOW()`,
    [sosId, odooId, JSON.stringify({ barcode })]
  );
}

async function pushOne(p, existingOdooId, force) {
  const vals        = buildProductVals(p);
  const valsNoCateg = { ...vals };
  delete valsNoCateg.categ_id;

  async function safeWrite(id, v) {
    try {
      await odoo.write('product.template', [id], v);
    } catch (err) {
      // Odoo may reject a stale categ_id — retry without it
      if (isCategMissing(err)) await odoo.write('product.template', [id], valsNoCateg);
      else throw err;
    }
  }

  async function safeCreate(v) {
    try {
      return await odoo.create('product.template', v);
    } catch (err) {
      if (isCategMissing(err)) return odoo.create('product.template', valsNoCateg);
      throw err;
    }
  }

  let odooId = existingOdooId;
  let action;

  if (existingOdooId) {
    const cur = await odoo.callKw('product.template', 'read', [[existingOdooId]], { fields: ['name', 'list_price'] });
    const ex  = cur?.[0];
    if (!ex) {
      // Odoo record was deleted — treat as new
      existingOdooId = null;
      odooId = null;
    } else {
      if (!force && ex.name === p.product_name && Number(ex.list_price) === Number(p.price)) {
        return { action: 'skipped', odooId: existingOdooId };
      }
      await safeWrite(existingOdooId, vals);
      await writeVariantBarcode(existingOdooId, p.barcode);
      action = 'updated';
      await upsertXref(p.product_id, existingOdooId, p.barcode);
    }
  }

  if (!existingOdooId) {
    odooId = null;

    // Try to find an existing Odoo product by barcode before creating
    if (p.barcode) {
      const found = await odoo.searchRead(
        'product.product',
        [['barcode', '=', p.barcode]],
        ['id', 'product_tmpl_id'],
        { limit: 1 }
      );
      if (found?.length) {
        const candidateId = Array.isArray(found[0].product_tmpl_id)
          ? found[0].product_tmpl_id[0]
          : found[0].product_tmpl_id;
        const clash = await query(
          `SELECT sos_id FROM integration_xref WHERE entity_type='product' AND odoo_id=$1`,
          [candidateId]
        );
        if (!clash.rows.length) {
          odooId = candidateId;
          await safeWrite(odooId, vals);
          await writeVariantBarcode(odooId, p.barcode);
          action = 'updated';
        }
      }
    }

    if (!odooId) {
      odooId = await safeCreate(vals);
      await writeVariantBarcode(odooId, p.barcode);
      action = 'created';
    }
    await upsertXref(p.product_id, odooId, p.barcode);
  }

  return { action, odooId };
}

/**
 * Push all active SOS products to Odoo (SOS → Odoo).
 * @param {boolean} force  When true, write even if values appear unchanged.
 */
async function pushProductsToOdoo(force = false) {
  if (_syncInProgress) {
    const err = new Error('Sync already in progress. Please wait.');
    err.statusCode = 409;
    throw err;
  }
  _syncInProgress = true;

  try {
    // Ensure a valid Odoo session exists before touching anything
    await odoo.authenticate();

    const [sosRows, xrefRows] = await Promise.all([
      query(
        `SELECT product_id, product_name, category, price, barcode,
                stock_quantity, odoo_categ_id, is_active
         FROM products
         WHERE is_active = true
         ORDER BY product_id`
      ),
      query(
        `SELECT sos_id, odoo_id FROM integration_xref
         WHERE entity_type = 'product' AND status = 'ACTIVE'`
      ),
    ]);

    const products  = sosRows.rows;
    const xrefBySos = Object.fromEntries(xrefRows.rows.map(r => [r.sos_id, Number(r.odoo_id)]));

    const stats  = { total: products.length, created: 0, updated: 0, skipped: 0, failed: 0 };
    const errors = [];

    for (const p of products) {
      try {
        const { action } = await pushOne(p, xrefBySos[p.product_id] || null, force);
        if (stats[action] !== undefined) stats[action]++;
      } catch (err) {
        stats.failed++;
        const msg = `${p.product_id} (${p.product_name}): ${err.message}`;
        errors.push(msg);
        logger.error('push-product-sync: product failed', { product_id: p.product_id, error: err.message });
      }
    }

    logger.info('push-product-sync: complete', stats);
    return { stats, errors, synced_at: new Date().toISOString() };
  } finally {
    _syncInProgress = false;
  }
}

module.exports = { pushProductsToOdoo };
