'use strict';

/**
 * Odoo adapter for posting chatter notes on product.template.
 */
class OdooChatterAdapter {
  /**
   * @param {import('../http/OdooHttpClient').OdooHttpClient} httpClient
   */
  constructor(httpClient) {
    this._http = httpClient;
  }

  /**
   * Post an internal chatter note (mt_note) after a successful stock sync.
   *
   * @param {number} templateId
   * @param {object} note
   * @param {string} note.batchId
   * @param {string} note.syncId
   * @param {number} note.qtyBefore
   * @param {number|null} note.qtyConfirmed
   * @param {string} note.triggeredBy
   * @param {Date}   note.triggeredAt
   */
  async postNote(templateId, { batchId, syncId, qtyBefore, qtyConfirmed, triggeredBy, triggeredAt }) {
    const body = [
      '<p><strong>SOS Stock Sync</strong></p>',
      '<ul>',
      `  <li><b>Batch ID:</b> ${batchId}</li>`,
      `  <li><b>Sync ID:</b> ${syncId}</li>`,
      `  <li><b>Previous qty:</b> ${qtyBefore ?? '—'} → <b>Confirmed qty:</b> ${qtyConfirmed ?? '—'}</li>`,
      `  <li><b>Synced by:</b> ${triggeredBy}</li>`,
      `  <li><b>Synced at:</b> ${new Date(triggeredAt).toISOString()}</li>`,
      '</ul>',
    ].join('\n');

    await this._http.callKw(
      'product.template', 'message_post',
      [[templateId]],
      { body, message_type: 'comment', subtype_xmlid: 'mail.mt_note' }
    );
  }
}

module.exports = { OdooChatterAdapter };
