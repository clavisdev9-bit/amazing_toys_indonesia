/**
 * @module templates/stockSync
 *
 * Log note template for stock synchronisation events:
 *   STOCK_SYNC_SUCCESS | STOCK_SYNC_FAILED | STOCK_SYNC_RETRY
 *
 * Returns two ordered row arrays — business and technical — that the
 * LogNoteFormatterService renders into separate HTML tables. Rows whose
 * value is null, undefined, or empty string are silently dropped by the
 * renderer; templates do not need to guard for that themselves.
 */

/**
 * Build the business and technical row arrays for a stock-sync log note.
 *
 * The `difference` field is auto-computed from newQty − previousQty when
 * both are present and `payload.difference` is not explicitly supplied.
 *
 * @param {object} payload
 * @param {string}  [payload.product]       - Product display name
 * @param {string}  [payload.sku]           - Product SKU / internal reference
 * @param {string}  [payload.location]      - Warehouse location, e.g. 'WH/Stock'
 * @param {number}  [payload.previousQty]   - Stock quantity before sync
 * @param {number}  [payload.newQty]        - Stock quantity after sync
 * @param {number}  [payload.difference]    - Explicit delta (overrides auto-compute)
 * @param {string}  [payload.batchId]       - UUID of the sync batch
 * @param {string}  [payload.syncId]        - UUID of this individual sync record
 * @param {string}  [payload.correlationId] - Request correlation ID
 * @param {string}  [payload.source]        - Origin system, e.g. 'SOS'
 * @param {string}  [payload.triggeredBy]   - Actor, e.g. 'system:auto' or 'kasir01'
 * @param {number}  [payload.retryCount]    - Number of retries attempted
 * @param {string}  [payload.duration]      - Sync duration, e.g. '1.2s'
 * @param {string}  [payload.syncedAt]      - UTC ISO timestamp of sync completion
 * @param {string}  [payload.errorCode]     - Error code, e.g. 'ODOO_RPC_500'
 * @param {string}  [payload.errorDetail]   - Human-readable error description
 *
 * @param {{ formatGMT7: Function, formatDifference: Function }} helpers
 * @returns {{ business: { label: string, value: * }[], technical: { label: string, value: * }[] }}
 */
export function stockSyncTemplate(payload, { formatGMT7, formatDifference }) {
  const rawDiff =
    payload.difference !== undefined && payload.difference !== null
      ? payload.difference
      : payload.newQty !== undefined && payload.previousQty !== undefined
        ? payload.newQty - payload.previousQty
        : null;

  const business = [
    { label: 'Product',      value: payload.product },
    { label: 'SKU',          value: payload.sku },
    { label: 'Location',     value: payload.location },
    { label: 'Previous Qty', value: payload.previousQty },
    { label: 'New Qty',      value: payload.newQty },
    { label: 'Difference',   value: formatDifference(rawDiff) },
  ];

  const technical = [
    { label: 'Batch ID',       value: payload.batchId },
    { label: 'Sync ID',        value: payload.syncId },
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
