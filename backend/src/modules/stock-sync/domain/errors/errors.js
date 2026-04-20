'use strict';

class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name     = this.constructor.name;
    this.code     = code;
    this.isDomain = true;
  }
}

/** Transient network or timeout failure — eligible for retry. */
class NetworkError extends DomainError {
  constructor(message, cause) {
    super(message, 'NETWORK_ERROR');
    this.isTransient = true;
    this.cause       = cause ?? null;
  }
}

/** Odoo authentication or session failure. */
class AuthError extends DomainError {
  constructor(message) { super(message, 'AUTH_ERROR'); }
}

/** The SOS product has no matching record in Odoo. */
class ProductNotFoundError extends DomainError {
  /** @param {string} identifier */
  constructor(identifier) {
    super(`Product "${identifier}" not found in Odoo.`, 'PRODUCT_NOT_FOUND');
    this.identifier = identifier;
  }
}

/** Input failed domain validation. */
class ValidationError extends DomainError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR');
    this.field = field ?? null;
  }
}

module.exports = { DomainError, NetworkError, AuthError, ProductNotFoundError, ValidationError };
