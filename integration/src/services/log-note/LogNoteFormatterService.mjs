/**
 * @module LogNoteFormatterService
 *
 * Pure HTML formatter for Odoo chatter log notes with structured, audit-friendly output.
 *
 * Architecture:
 *   - This module is PURE: it has no I/O, no side effects, and no Odoo dependencies.
 *   - All rendering stays here; no HTML string construction in business logic callers.
 *   - LogNoteAdapter handles the actual Odoo RPC call.
 *   - Templates (per event family) decide which payload fields appear and in what order.
 *
 * Usage:
 *   import { LogNoteFormatterService } from './services/log-note/LogNoteFormatterService.mjs';
 *
 *   // Render only (no network call):
 *   const html = LogNoteFormatterService.render('STOCK_SYNC_SUCCESS', payload);
 *
 *   // Render + post to Odoo chatter in one call:
 *   await LogNoteFormatterService.post({ event, model, recordId, payload });
 */

import { stockSyncTemplate }    from './templates/stockSync.mjs';
import { orderConfirmTemplate } from './templates/orderConfirm.mjs';
import { posSessionTemplate }   from './templates/posSession.mjs';
import { LogNoteAdapter }       from './LogNoteAdapter.mjs';

// ── Event registry ────────────────────────────────────────────────────────────

/** @type {Record<string, 'INFO'|'WARNING'|'ERROR'>} */
const EVENT_SEVERITY = {
  STOCK_SYNC_SUCCESS: 'INFO',
  STOCK_SYNC_FAILED:  'ERROR',
  STOCK_SYNC_RETRY:   'WARNING',
  ORDER_CONFIRMED:    'INFO',
  ORDER_FAILED:       'ERROR',
  POS_SESSION_OPENED: 'INFO',
  POS_SESSION_CLOSED: 'INFO',
};

/** Human-readable display label inserted into the note header. */
const EVENT_LABEL = {
  STOCK_SYNC_SUCCESS: 'STOCK SYNC SUCCESS',
  STOCK_SYNC_FAILED:  'STOCK SYNC FAILED',
  STOCK_SYNC_RETRY:   'STOCK SYNC RETRY',
  ORDER_CONFIRMED:    'ORDER CONFIRMED',
  ORDER_FAILED:       'ORDER FAILED',
  POS_SESSION_OPENED: 'POS SESSION OPENED',
  POS_SESSION_CLOSED: 'POS SESSION CLOSED',
};

/**
 * Maps each event type to its template function.
 * Multiple event types may share the same template (e.g. all STOCK_SYNC_* events).
 *
 * @type {Record<string, Function>}
 */
const EVENT_TEMPLATE = {
  STOCK_SYNC_SUCCESS: stockSyncTemplate,
  STOCK_SYNC_FAILED:  stockSyncTemplate,
  STOCK_SYNC_RETRY:   stockSyncTemplate,
  ORDER_CONFIRMED:    orderConfirmTemplate,
  ORDER_FAILED:       orderConfirmTemplate,
  POS_SESSION_OPENED: posSessionTemplate,
  POS_SESSION_CLOSED: posSessionTemplate,
};

// ── Helper functions (private) ────────────────────────────────────────────────

/**
 * Convert a UTC ISO timestamp string to a GMT+7 display string.
 *
 * Uses native Intl.DateTimeFormat (sv-SE locale produces YYYY-MM-DD HH:mm:ss
 * without any extra formatting). No external library required.
 *
 * @param {string|null|undefined} isoString
 * @returns {string|null} Formatted string, e.g. '2026-05-06 16:35:59 GMT+7', or null if no input.
 */
function formatGMT7(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return String(isoString);
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
  }).format(date);
  return `${formatted} GMT+7`;
}

/**
 * Format a numeric difference value with an explicit +/- sign prefix.
 *
 * Returns null for any non-numeric or absent input so the renderer omits
 * the row entirely rather than displaying an empty or meaningless value.
 *
 * @param {number|string|null|undefined} value
 * @returns {string|null} e.g. '+30', '-5', '0' → '+0'
 */
function formatDifference(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) return null;
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Escape HTML special characters to prevent injection in Odoo chatter notes.
 *
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Determine whether a value should produce a visible table row.
 * Returns false for null, undefined, and empty string; true otherwise
 * (including 0 and false, which are meaningful data values).
 *
 * @param {*} value
 * @returns {boolean}
 */
function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

/**
 * Render an HTML <table> from an array of { label, value } row descriptors.
 * Rows where value fails the hasValue check are silently omitted.
 *
 * @param {{ label: string, value: * }[]} rows
 * @returns {string} Complete <table>…</table> HTML, or '' if all rows are empty.
 */
function renderTable(rows) {
  const valid = rows.filter(r => hasValue(r.value));
  if (valid.length === 0) return '';
  const trs = valid
    .map(r => `    <tr><td><b>${escHtml(r.label)}</b></td><td>${escHtml(String(r.value))}</td></tr>`)
    .join('\n');
  return `<table cellpadding="3" cellspacing="0">\n${trs}\n  </table>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a structured HTML log note for the given event type and payload.
 *
 * This function is pure — it performs no I/O. Use `post()` to render and
 * send in one call, or `LogNoteAdapter.post()` if you need to send a
 * note you rendered separately.
 *
 * Output structure:
 *   [SEVERITY][EVENT LABEL]
 *   ─ Business table  (product, order info, session info, …)
 *   ─ Horizontal rule
 *   ─ Technical table (UUIDs, timestamps, error details, …)
 *
 * @param {string} event   - One of the EVENT_SEVERITY keys, e.g. 'STOCK_SYNC_SUCCESS'
 * @param {object} payload - Flat data object; unused fields are silently ignored
 * @returns {string} Rendered HTML string ready for Odoo's mail.message body
 * @throws {Error} If `event` is not a recognised event type
 */
function render(event, payload) {
  const severity = EVENT_SEVERITY[event];
  const label    = EVENT_LABEL[event];
  const template = EVENT_TEMPLATE[event];

  if (!severity || !label || !template) {
    throw new Error(
      `LogNoteFormatterService.render: unknown event type "${event}". ` +
      `Valid types: ${Object.keys(EVENT_SEVERITY).join(', ')}.`
    );
  }

  const helpers = { formatGMT7, formatDifference };
  const { business, technical } = template(payload, helpers);

  const businessHtml  = renderTable(business);
  const technicalHtml = renderTable(technical);
  const separator     = businessHtml && technicalHtml ? '\n  <hr/>' : '';

  const parts = [
    '<div style="font-family:monospace; font-size:13px;">',
    `  <h4 style="margin:0 0 8px;">[${severity}][${label}]</h4>`,
  ];

  if (businessHtml)  parts.push(`  ${businessHtml}`);
  if (separator)     parts.push(separator);
  if (technicalHtml) parts.push(`  ${technicalHtml}`);

  parts.push('</div>');

  return parts.join('\n');
}

/**
 * Render a log note and post it to the Odoo chatter of the target record.
 *
 * This is the primary entry point for business logic callers. No HTML
 * construction should exist outside this service.
 *
 * @param {object} options
 * @param {string}  options.event     - Event type constant, e.g. 'STOCK_SYNC_SUCCESS'
 * @param {string}  options.model     - Odoo model name, e.g. 'sale.order', 'stock.picking'
 * @param {number}  options.recordId  - Database ID of the Odoo record to annotate
 * @param {object}  options.payload   - Flat data object with any supported payload fields
 * @param {string}  [options.subtype] - Odoo subtype XML ID (default: 'mail.mt_note')
 * @returns {Promise<void>}
 * @throws {Error} If the event type is unknown or the Odoo RPC call fails
 */
async function post({ event, model, recordId, payload, subtype = 'mail.mt_note' }) {
  const html = render(event, payload);
  await LogNoteAdapter.post({ model, recordId, html, subtype });
}

export const LogNoteFormatterService = { render, post };
