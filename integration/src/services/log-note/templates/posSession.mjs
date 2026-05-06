/**
 * @module templates/posSession
 *
 * Log note template for POS session lifecycle events:
 *   POS_SESSION_OPENED | POS_SESSION_CLOSED
 */

/**
 * Build the business and technical row arrays for a POS-session log note.
 *
 * @param {object} payload
 * @param {string}  [payload.posSession]    - POS session identifier, e.g. 'POS-SESSION-001'
 * @param {string}  [payload.terminalId]    - POS terminal ID
 * @param {string}  [payload.cashier]       - Cashier username, e.g. 'kasir01'
 * @param {string}  [payload.correlationId] - Request correlation ID
 * @param {string}  [payload.source]        - Origin system, e.g. 'SOS'
 * @param {string}  [payload.triggeredBy]   - Actor, e.g. 'system:auto' or 'kasir01'
 * @param {string}  [payload.syncedAt]      - UTC ISO timestamp of the session event
 * @param {string}  [payload.errorCode]     - Error code (for failed open/close events)
 * @param {string}  [payload.errorDetail]   - Human-readable error description
 *
 * @param {{ formatGMT7: Function, formatDifference: Function }} helpers
 * @returns {{ business: { label: string, value: * }[], technical: { label: string, value: * }[] }}
 */
export function posSessionTemplate(payload, { formatGMT7 }) {
  const business = [
    { label: 'POS Session', value: payload.posSession },
    { label: 'Terminal ID', value: payload.terminalId },
    { label: 'Cashier',     value: payload.cashier },
  ];

  const technical = [
    { label: 'Correlation ID', value: payload.correlationId },
    { label: 'Source',         value: payload.source },
    { label: 'Triggered By',   value: payload.triggeredBy },
    { label: 'Synced At',      value: formatGMT7(payload.syncedAt) },
    { label: 'Error Code',     value: payload.errorCode },
    { label: 'Error Detail',   value: payload.errorDetail },
  ];

  return { business, technical };
}
