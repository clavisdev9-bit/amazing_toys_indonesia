'use strict';

const odoo = require('../clients/odoo.client');
const xref = require('../utils/xref');
const audit = require('../utils/audit');
const logger = require('../config/logger');
const env = require('../config/env');

const PHONE_REGEX = /^08[0-9]{8,11}$/;

/**
 * FR-003: Resolve or create Odoo res.partner from SOS customer data.
 * Returns Odoo partner_id (integer). Falls back to walk-in partner on failure.
 */
async function resolveOrCreatePartner(customer) {
  const { customer_id, full_name, phone_number, email, gender } = customer;

  if (!PHONE_REGEX.test(phone_number)) {
    logger.warn('Customer sync: invalid phone format', { customer_id, phone_number });
    audit.log({ operation_type: 'CUSTOMER_SYNC', entity_type: 'customer', sos_entity_id: customer_id, action: 'SKIP', status: 'FAILED', error_message: 'Invalid phone format' });
    return env.ODOO_WALKIN_PARTNER_ID;
  }

  try {
    // Step 1: search by ref = SOS customer_id
    let partners = await odoo.searchRead('res.partner', [['ref', '=', customer_id]], ['id', 'name', 'phone', 'ref']);
    if (partners.length > 0) {
      const partnerId = partners[0].id;
      await odoo.write('res.partner', [partnerId], { name: full_name, email: email || false });
      await xref.upsertXref('customer', customer_id, partnerId);
      audit.log({ operation_type: 'CUSTOMER_SYNC', entity_type: 'customer', sos_entity_id: customer_id, odoo_entity_id: partnerId, action: 'UPDATE', status: 'SUCCESS' });
      return partnerId;
    }

    // Step 2: search by phone
    partners = await odoo.searchRead('res.partner', [['phone', '=', phone_number]], ['id', 'name', 'phone', 'ref']);
    if (partners.length > 0) {
      const partnerId = partners[0].id;
      await odoo.write('res.partner', [partnerId], { ref: customer_id, name: full_name, email: email || false });
      await xref.upsertXref('customer', customer_id, partnerId);
      audit.log({ operation_type: 'CUSTOMER_SYNC', entity_type: 'customer', sos_entity_id: customer_id, odoo_entity_id: partnerId, action: 'UPDATE', status: 'SUCCESS' });
      return partnerId;
    }

    // Step 3: create new partner
    const comment = gender ? `Gender: ${gender}` : '';
    const partnerId = await odoo.create('res.partner', {
      name: full_name,
      phone: phone_number,
      mobile: phone_number,
      email: email || false,
      customer_rank: 1,
      ref: customer_id,
      active: true,
      comment,
    });
    await xref.upsertXref('customer', customer_id, partnerId);
    audit.log({ operation_type: 'CUSTOMER_SYNC', entity_type: 'customer', sos_entity_id: customer_id, odoo_entity_id: partnerId, action: 'CREATE', status: 'SUCCESS' });
    return partnerId;
  } catch (err) {
    logger.error('Customer sync: failed', { customer_id, error: err.message });
    audit.log({ operation_type: 'CUSTOMER_SYNC', entity_type: 'customer', sos_entity_id: customer_id, action: 'FAIL', status: 'FAILED', error_message: err.message });
    return env.ODOO_WALKIN_PARTNER_ID;
  }
}

module.exports = { resolveOrCreatePartner };
