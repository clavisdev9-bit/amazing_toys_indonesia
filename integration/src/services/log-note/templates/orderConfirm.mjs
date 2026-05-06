/**
 * @module templates/orderConfirm
 *
 * Log note template for order lifecycle events:
 *   ORDER_CONFIRMED | ORDER_FAILED
 */

/**
 * Build the business and technical row arrays for an order-confirmation log note.
 *
 * @param {object} payload
 * @param {string}  [payload.orderRef]      - SOS transaction reference, e.g. 'TXN-20260506-00006'
 * @param {string}  [payload.cashier]       - Cashier username, e.g. 'kasir01'
 * @param {string}  [payload.batchId]       - UUID of the processing batch
 * @param {string}  [payload.correlationId] - Request correlation ID
 * @param {string}  [payload.source]        - Origin system, e.g. 'SOS'
 * @param {string}  [payload.triggeredBy]   - Actor, e.g. 'system:auto' or 'kasir01'
 * @param {number}  [payload.retryCount]    - Number of retries attempted
 * @param {string}  [payload.duration]      - Processing duration, e.g. '0.8s'
 * @param {string}  [payload.syncedAt]      - UTC ISO timestamp of confirmation
 * @param {string}  [payload.errorCode]     - Error code, e.g. 'ODOO_RPC_500'
 * @param {string}  [payload.errorDetail]   - Human-readable error description
 *
 * @param {{ formatGMT7: Function, formatDifference: Function }} helpers
 * @returns {{ business: { label: string, value: * }[], technical: { label: string, value: * }[] }}
 */
export function orderConfirmTemplate(payload, { formatGMT7 }) {
  const business = [
    { label: 'Order Ref', value: payload.orderRef },
    { label: 'Cashier',   value: payload.cashier },
  ];

  const technical = [
    { label: 'Batch ID',       value: payload.batchId },
    { label: 'Correlation ID', value: payload.correlationId },
    { label: 'Source',         value: payload.source },
    { label: 'Triggered By',   value: payload.triggeredBy },
    { label: 'Retry Count',    value: payload.retryCount },
    { label: 'Duration',       value: payload.duration },
    { label: 'Synced At',      value: formatGMT7(payload.syncedAt) },
    { label: 'Error Code',     value: payload.errorCode },
    { label: 'Error Detail',   value: payload.errorDetail },
  ];

  return { business, technical };
}
