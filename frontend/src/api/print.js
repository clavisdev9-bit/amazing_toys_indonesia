import client from './client';

/**
 * Send receipt to thermal printer via ESC/POS (TCP).
 * Returns { success, message } from backend.
 */
export async function directPrintReceipt({ txn, success, cashierName, customer, cashReceived }) {
  const res = await client.post('/print/receipt', {
    txn,
    success,
    cashierName,
    customer,
    cashReceived,
  });
  return res.data;
}

/**
 * Check if the thermal printer is configured and reachable.
 * Returns { configured, connected, address, message }
 */
export async function getPrinterStatus() {
  const res = await client.get('/print/status');
  return res.data;
}
