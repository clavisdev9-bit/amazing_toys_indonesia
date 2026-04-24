'use strict';

const env = require('../config/env');

/** Derive SOS stock status string from a numeric quantity. */
function deriveStockStatus(qty) {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= env.LOW_STOCK_THRESHOLD) return 'LOW_STOCK';
  return 'AVAILABLE';
}

module.exports = { deriveStockStatus };
