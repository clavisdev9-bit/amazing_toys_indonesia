'use strict';

const { query } = require('../config/database');

async function getXref(entityType, sosId) {
  const r = await query(
    `SELECT * FROM integration_xref WHERE entity_type = $1 AND sos_id = $2`,
    [entityType, sosId]
  );
  return r.rows[0] || null;
}

async function upsertXref(entityType, sosId, odooId, metadata = {}) {
  await query(
    `INSERT INTO integration_xref (entity_type, sos_id, odoo_id, sync_metadata, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (entity_type, sos_id) DO UPDATE
       SET odoo_id = EXCLUDED.odoo_id,
           sync_metadata = EXCLUDED.sync_metadata,
           status = 'ACTIVE',
           updated_at = NOW()`,
    [entityType, sosId, odooId, JSON.stringify(metadata)]
  );
}

async function markXrefCancelled(entityType, sosId) {
  await query(
    `UPDATE integration_xref SET status = 'CANCELLED', updated_at = NOW()
     WHERE entity_type = $1 AND sos_id = $2`,
    [entityType, sosId]
  );
}

async function getOdooIdBySosId(entityType, sosId) {
  const xref = await getXref(entityType, sosId);
  return xref?.odoo_id || null;
}

module.exports = { getXref, upsertXref, markXrefCancelled, getOdooIdBySosId };
