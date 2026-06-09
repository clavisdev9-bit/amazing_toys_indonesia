'use strict';

const { AppError } = require('../../middlewares/error.middleware');

/**
 * Legal status transitions for CR-035 Hybrid Model C and CR-040 HELPER_APPROVE (Model D).
 *
 * Legacy self-order orders use PENDING in place of WAITING_PAYMENT —
 * treat PENDING as an alias for WAITING_PAYMENT at the cashier layer.
 *
 * PENDING_APPROVAL (Model D) — customer self-order held for helper review.
 * On approve: transitions to PENDING (stock deducted + timer starts).
 * On reject:  transitions to CANCELLED.
 *
 * Transition map: fromStatus → Set<toStatus>
 */
const TRANSITIONS = {
  PENDING_APPROVAL: new Set(['PENDING', 'CANCELLED']),                           // CR-040 Model D
  PENDING:          new Set(['WAITING_PAYMENT', 'CANCELLED', 'EXPIRED', 'PAID']), // legacy compat
  RESERVED:         new Set(['WAITING_PAYMENT', 'CANCELLED', 'EXPIRED']),
  WAITING_PAYMENT:  new Set(['PAID', 'CANCELLED', 'EXPIRED']),
  PAID:             new Set(['HANDED_OVER']),
  HANDED_OVER:      new Set(['COMPLETED']),
  CANCELLED:        new Set(),
  EXPIRED:          new Set(),
  COMPLETED:        new Set(),
};

/**
 * Which roles may trigger each target status.
 * Roles listed here are the ONLY ones allowed to perform the transition.
 */
const ALLOWED_ACTORS = {
  PENDING:         ['HELPER'],                                       // helper approves → PENDING
  RESERVED:        ['HELPER'],
  WAITING_PAYMENT: ['CASHIER', 'LEADER', 'ADMIN'],
  PAID:            ['CASHIER', 'LEADER', 'ADMIN'],
  CANCELLED:       ['HELPER', 'CASHIER', 'LEADER', 'ADMIN'],
  EXPIRED:         ['SYSTEM'],
  HANDED_OVER:     ['HELPER', 'TENANT', 'LEADER', 'ADMIN'],
  COMPLETED:       ['HELPER', 'TENANT', 'LEADER', 'ADMIN', 'SYSTEM'],
};

/**
 * Validate and return the target status after checking:
 *  1. The transition is legal for the current status.
 *  2. The actor's role is permitted to trigger it.
 *
 * @param {object} order      - Must have at least { transaction_id, status }
 * @param {string} toStatus   - Target status string
 * @param {string} actorRole  - Role from JWT (HELPER, CASHIER, TENANT, …)
 * @throws {AppError} 409 on illegal transition, 403 on role violation
 * @returns {string}  Validated toStatus
 */
function validateTransition(order, toStatus, actorRole) {
  const from = order.status;

  const legal = TRANSITIONS[from];
  if (!legal) {
    throw new AppError(`Status '${from}' tidak dikenal.`, 500);
  }
  if (!legal.has(toStatus)) {
    throw new AppError(
      `Transisi dari '${from}' ke '${toStatus}' tidak diizinkan.`,
      409,
    );
  }

  const allowedRoles = ALLOWED_ACTORS[toStatus] || [];
  if (!allowedRoles.includes(actorRole)) {
    throw new AppError(
      `Role '${actorRole}' tidak berhak mengubah status ke '${toStatus}'. ` +
      `Dibutuhkan: ${allowedRoles.join(' / ')}.`,
      403,
    );
  }

  return toStatus;
}

/**
 * Check if a status is considered "open" (can still be processed by cashier).
 * Used for backward compat with legacy PENDING orders.
 */
function isCashierProcessable(status) {
  return status === 'RESERVED' || status === 'PENDING' || status === 'WAITING_PAYMENT';
}

/**
 * Normalise legacy PENDING → WAITING_PAYMENT for display purposes only.
 * Never use this to UPDATE the DB; PENDING rows should stay PENDING.
 */
function displayStatus(status) {
  return status === 'PENDING' ? 'WAITING_PAYMENT' : status;
}

module.exports = { validateTransition, isCashierProcessable, displayStatus, TRANSITIONS, ALLOWED_ACTORS };
