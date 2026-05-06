/**
 * @module LogNoteAdapter
 *
 * Sends a pre-rendered HTML log note to the Odoo chatter of a specific record
 * using JSON-RPC (message_post). This module has side effects by design — it is
 * the single point of contact between the formatter and Odoo's mail system.
 *
 * Separation of concerns:
 *   LogNoteFormatterService  →  pure rendering, no I/O
 *   LogNoteAdapter           →  I/O only, no rendering
 */

// CJS interop: odoo.client.js uses CommonJS module.exports.
// In ESM, CJS modules are imported as a default export — destructure after.
import odooClientModule from '../../clients/odoo.client.js';

const { callKw } = odooClientModule;

/**
 * Post a pre-rendered HTML note to the Odoo chatter of the given record.
 *
 * The note is posted as an internal log note (not a customer-facing email).
 * It appears in the chatter as an activity by the authenticated Odoo user.
 *
 * @param {object} options
 * @param {string}  options.model     - Odoo model name, e.g. 'sale.order', 'stock.picking'
 * @param {number}  options.recordId  - Database ID of the target Odoo record
 * @param {string}  options.html      - Rendered HTML body (from LogNoteFormatterService)
 * @param {string}  [options.subtype] - Odoo subtype XML ID. Defaults to 'mail.mt_note'
 *                                      (internal note). Use 'mail.mt_comment' for
 *                                      messages visible to followers.
 * @returns {Promise<void>}
 * @throws {Error} If the Odoo RPC call fails (session expired, permission denied, etc.)
 */
async function post({ model, recordId, html, subtype = 'mail.mt_note' }) {
  await callKw(model, 'message_post', [[recordId]], {
    body:            html,
    message_type:    'comment',
    subtype_xmlid:   subtype,
  });
}

export const LogNoteAdapter = { post };
