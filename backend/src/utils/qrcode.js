'use strict';

const QRCode = require('qrcode');

/**
 * Generate a base64-encoded PNG QR code for a transaction.
 * The payload contains the transaction ID for cashier scanning.
 *
 * @param {string} transactionId  e.g. TXN-20260415-00001
 * @returns {Promise<string>}     Base64 string (without data URL prefix) to be used in data:image/png;base64,{result}
 */
async function generateTransactionQR(transactionId) {
  const payload = JSON.stringify({
    txn: transactionId,
    ts:  Date.now(),
  });
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  });
  // Return only the base64 portion (remove 'data:image/png;base64,' prefix)
  // Frontend will add the prefix when constructing the src
  return dataUrl.split(',')[1];
}

module.exports = { generateTransactionQR };
