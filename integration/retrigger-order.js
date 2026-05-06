'use strict';
/**
 * One-off script: manually re-trigger an order push to Odoo.
 * Usage: node retrigger-order.js TXN-20260424-00130
 */
require('dotenv').config();
const { pushOrder } = require('./src/services/order.push');

const txnId = process.argv[2];
if (!txnId) {
  console.error('Usage: node retrigger-order.js <transactionId>');
  process.exit(1);
}

pushOrder(txnId).then(result => {
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}).catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
