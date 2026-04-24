'use strict';

const odoo = require('../clients/odoo.client');
const xref = require('../utils/xref');
const audit = require('../utils/audit');
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * Return the Odoo customer virtual location ID from the startup cache,
 * or null if not yet resolved.  Required so action_confirm can create
 * delivery orders without a "No rule found in False" error.
 */
function _customerLocationId() {
  return odoo.getCache().customerLocationId || null;
}

const PHONE_REGEX = /^08[0-9]{8,11}$/;

/**
 * FR-003: Resolve or create Odoo res.partner from SOS customer data.
 *
 * Resolution order (prevents duplicate partners):
 *   1. Search by ref = SOS customer_id  (most precise — our own FK)
 *   2. Search by phone                  (only when phone is valid Indonesian mobile)
 *   3. Search by email                  (deduplication for customers with changed phones)
 *   4. Create new partner
 *
 * Returns Odoo partner_id (integer). Falls back to ODOO_WALKIN_PARTNER_ID only
 * when all resolution paths fail with an exception.
 */
async function resolveOrCreatePartner(customer) {
  const { customer_id, full_name, phone_number, email, gender } = customer;

  const phoneValid = PHONE_REGEX.test(phone_number);
  if (!phoneValid) {
    logger.warn('Customer sync: phone not in Indonesian mobile format — skipping phone lookup', {
      customer_id,
      phone_number,
    });
  }

  try {
    // ── Step 1: match by SOS customer_id stored in Odoo ref field ────────────
    let partners = await odoo.searchRead(
      'res.partner',
      [['ref', '=', customer_id]],
      ['id', 'name', 'phone', 'ref']
    );
    if (partners.length > 0) {
      const partnerId = partners[0].id;
      const updateVals = { name: full_name, email: email || false };
      if (phoneValid) updateVals.phone = phone_number;
      await odoo.write('res.partner', [partnerId], updateVals);
      await xref.upsertXref('customer', customer_id, partnerId);
      audit.log({
        operation_type: 'CUSTOMER_SYNC',
        entity_type: 'customer',
        sos_entity_id: customer_id,
        odoo_entity_id: partnerId,
        action: 'UPDATE',
        status: 'SUCCESS',
      });
      return partnerId;
    }

    // ── Step 2: match by phone ────────────────────────────────────────────────
    if (phoneValid) {
      partners = await odoo.searchRead(
        'res.partner',
        [['phone', '=', phone_number]],
        ['id', 'name', 'phone', 'ref']
      );
      if (partners.length > 0) {
        const partnerId = partners[0].id;
        await odoo.write('res.partner', [partnerId], {
          ref: customer_id,
          name: full_name,
          email: email || false,
        });
        await xref.upsertXref('customer', customer_id, partnerId);
        audit.log({
          operation_type: 'CUSTOMER_SYNC',
          entity_type: 'customer',
          sos_entity_id: customer_id,
          odoo_entity_id: partnerId,
          action: 'UPDATE',
          status: 'SUCCESS',
        });
        return partnerId;
      }
    }

    // ── Step 3: match by email (prevents duplicates for customers with changed phones) ──
    if (email) {
      partners = await odoo.searchRead(
        'res.partner',
        [['email', '=', email], ['customer_rank', '>', 0]],
        ['id', 'name', 'email', 'ref']
      );
      if (partners.length > 0) {
        const partnerId = partners[0].id;
        const updateVals = { ref: customer_id, name: full_name, email };
        if (phoneValid) updateVals.phone = phone_number;
        await odoo.write('res.partner', [partnerId], updateVals);
        await xref.upsertXref('customer', customer_id, partnerId);
        audit.log({
          operation_type: 'CUSTOMER_SYNC',
          entity_type: 'customer',
          sos_entity_id: customer_id,
          odoo_entity_id: partnerId,
          action: 'UPDATE',
          status: 'SUCCESS',
        });
        return partnerId;
      }
    }

    // ── Step 4: create new partner ────────────────────────────────────────────
    const newVals = {
      name: full_name,
      email: email || false,
      customer_rank: 1,
      ref: customer_id,
      active: true,
      comment: gender ? `Gender: ${gender}` : '',
    };
    if (phoneValid) {
      newVals.phone = phone_number;
      newVals.mobile = phone_number;
    }
    // Required for action_confirm to resolve delivery routes (prevents "No rule found in False").
    const custLocId = _customerLocationId();
    if (custLocId) newVals.property_stock_customer = custLocId;
    const partnerId = await odoo.create('res.partner', newVals);
    await xref.upsertXref('customer', customer_id, partnerId);
    audit.log({
      operation_type: 'CUSTOMER_SYNC',
      entity_type: 'customer',
      sos_entity_id: customer_id,
      odoo_entity_id: partnerId,
      action: 'CREATE',
      status: 'SUCCESS',
    });
    return partnerId;
  } catch (err) {
    logger.error('Customer sync: failed — falling back to walk-in partner', {
      customer_id,
      error: err.message,
    });
    audit.log({
      operation_type: 'CUSTOMER_SYNC',
      entity_type: 'customer',
      sos_entity_id: customer_id,
      action: 'FAIL',
      status: 'FAILED',
      error_message: err.message,
    });
    return env.ODOO_WALKIN_PARTNER_ID;
  }
}

module.exports = { resolveOrCreatePartner };
