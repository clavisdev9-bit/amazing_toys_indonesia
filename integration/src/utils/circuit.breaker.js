'use strict';

const logger = require('../config/logger');
const env = require('../config/env');

// Per-system circuit breakers
const _breakers = {};

function getBreaker(name) {
  if (!_breakers[name]) {
    _breakers[name] = {
      name,
      state: 'CLOSED',      // CLOSED | OPEN | HALF-OPEN
      failures: 0,
      lastFailureAt: null,
      openedAt: null,
    };
  }
  return _breakers[name];
}

function recordSuccess(name) {
  const b = getBreaker(name);
  b.failures = 0;
  if (b.state !== 'CLOSED') {
    logger.info(`Circuit breaker CLOSED: ${name}`);
    b.state = 'CLOSED';
  }
}

function recordFailure(name) {
  const b = getBreaker(name);
  b.failures += 1;
  b.lastFailureAt = Date.now();

  if (b.failures >= env.CIRCUIT_BREAKER_THRESHOLD && b.state === 'CLOSED') {
    b.state = 'OPEN';
    b.openedAt = Date.now();
    logger.error(`Circuit breaker OPEN: ${name} (${b.failures} consecutive failures)`);
  }
}

function isOpen(name) {
  const b = getBreaker(name);
  if (b.state === 'CLOSED') return false;

  const resetMs = env.CIRCUIT_BREAKER_RESET_MIN * 60 * 1000;
  if (b.state === 'OPEN' && Date.now() - b.openedAt >= resetMs) {
    b.state = 'HALF-OPEN';
    logger.info(`Circuit breaker HALF-OPEN: ${name} — sending probe`);
    return false; // allow one probe request
  }

  return b.state === 'OPEN';
}

function getStatus() {
  const out = {};
  for (const [name, b] of Object.entries(_breakers)) {
    out[name] = { state: b.state, failures: b.failures };
  }
  return out;
}

module.exports = { recordSuccess, recordFailure, isOpen, getStatus };
