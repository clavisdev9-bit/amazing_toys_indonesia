'use strict';

const { SYNC_STATUS } = require('./SyncStatus');

class StockSyncRecord {
  /**
   * @param {object}      props
   * @param {string}      props.syncId
   * @param {string}      props.batchId
   * @param {string}      props.triggeredBy
   * @param {Date}        props.triggeredAt
   * @param {string}      props.productId        — sos_product_id
   * @param {number|null} props.odooProductId
   * @param {number|null} [props.odooQuantId]
   * @param {number|null} [props.locationId]
   * @param {number|null} [props.qtyBefore]
   * @param {number}      props.qtySent          — what SOS sent
   * @param {number|null} [props.qtyConfirmed]   — what Odoo confirmed
   * @param {string|null} [props.eligibilityRule]
   * @param {string}      [props.status]
   * @param {string|null} [props.errorCode]
   * @param {string|null} [props.errorMessage]
   * @param {object|null} [props.odooResponse]
   * @param {number|null} [props.durationMs]
   */
  constructor({
    syncId, batchId, triggeredBy, triggeredAt, productId, odooProductId,
    odooQuantId = null, locationId = null, qtyBefore = null, qtySent,
    qtyConfirmed = null, eligibilityRule = null, status, errorCode = null,
    errorMessage = null, odooResponse = null, durationMs = null,
  }) {
    this.syncId          = syncId;
    this.batchId         = batchId;
    this.triggeredBy     = triggeredBy;
    this.triggeredAt     = triggeredAt;
    this.direction       = 'SOS → Odoo';
    this.productId       = productId;
    this.odooProductId   = odooProductId   ?? null;
    this.odooQuantId     = odooQuantId;
    this.locationId      = locationId;
    this.qtyBefore       = qtyBefore;
    this.qtySent         = qtySent;
    this.qtyConfirmed    = qtyConfirmed;
    this.eligibilityRule = eligibilityRule;
    this.status          = status          ?? SYNC_STATUS.PENDING;
    this.errorCode       = errorCode;
    this.errorMessage    = errorMessage;
    this.odooResponse    = odooResponse;
    this.durationMs      = durationMs;
  }

  isSuccess() { return this.status === SYNC_STATUS.SUCCESS; }
  isFailed()  { return this.status === SYNC_STATUS.FAILED;  }
  isSkipped() { return this.status === SYNC_STATUS.SKIPPED; }
}

module.exports = { StockSyncRecord };
