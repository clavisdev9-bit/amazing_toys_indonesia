'use strict';

const logger = require('../config/logger');

// In-memory cache populated once at startup
let _ppnTaxOdooId = null;

/**
 * Resolve and cache Odoo IDs that are needed at order-push time.
 * Call once after the server is up and Odoo credentials are available.
 *
 * Priority:
 *   1. Explicit odoo_tax_id stored in system_settings.tax_config (set via Admin → Pajak & SPT)
 *   2. Auto-search: find the active 12% PPN sale tax in Odoo by rate + name
 *
 * @param {Function} odooRpc   Ready-to-use RPC function from _connectOdoo()
 * @param {object}  [dbQuery]  Optional query function for reading system_settings (avoids circular import)
 */
async function resolveStartupRefs(odooRpc, dbQuery) {
  try {
    // ── Priority 1: use the explicitly configured Odoo tax ID ──────────────
    if (dbQuery) {
      try {
        const row = await dbQuery("SELECT value FROM system_settings WHERE key = 'tax_config'");
        if (row.rows.length > 0) {
          const cfg = JSON.parse(row.rows[0].value);
          if (cfg.odoo_tax_id) {
            _ppnTaxOdooId = parseInt(cfg.odoo_tax_id, 10);
            logger.info(`[startupRefs] PPN tax ID loaded from config → ${_ppnTaxOdooId} ("${cfg.odoo_tax_name || ''}")`);
            return;
          }
        }
      } catch { /* ignore — fall through to auto-search */ }
    }

    // ── Priority 2: auto-search Odoo for an active 12% sale tax ───────────
    const taxes = await odooRpc(
      'account.tax',
      'search_read',
      [[
        ['amount', '=', 12],
        ['type_tax_use', '=', 'sale'],
        ['active', '=', true],
      ]],
      { fields: ['id', 'name', 'amount'], limit: 5 },
    );

    if (Array.isArray(taxes) && taxes.length > 0) {
      // Prefer a record whose name contains "PPN" if multiple 12% sale taxes exist
      const preferred = taxes.find((t) => /ppn/i.test(t.name)) ?? taxes[0];
      _ppnTaxOdooId = preferred.id;
      logger.info(`[startupRefs] PPN tax auto-resolved → Odoo ID ${_ppnTaxOdooId} ("${preferred.name}")`);
    } else {
      logger.warn('[startupRefs] No 12% sale tax found in Odoo — order lines will have no tax applied');
    }
  } catch (err) {
    logger.warn(`[startupRefs] Could not resolve PPN tax ID: ${err.message}`);
  }
}

/** Returns the cached Odoo account.tax ID for PPN 12%, or null if not resolved. */
function getPpnTaxOdooId() {
  return _ppnTaxOdooId;
}

module.exports = { resolveStartupRefs, getPpnTaxOdooId };
