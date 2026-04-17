import client from '../api/client';

const EVENT_NAME = 'Amazing Toys Fair 2026';
const EVENT_VENUE = 'JCC Senayan, Jakarta';

/**
 * POST /api/v1/receipts/send-email
 * Returns { success: true } or { success: false, error: string } — never throws.
 */
export async function sendEReceipt(txn, success, customer) {
  try {
    await client.post('/receipts/send-email', {
      to: customer.email,
      customerName: customer.name,
      transactionId: txn.transaction_id,
      eventName: EVENT_NAME,
      eventVenue: EVENT_VENUE,
      cashier: success?.cashierId ?? '',
      createdAt: success?.paidAt ?? txn.checkout_time,
      paymentMethod: success?.paymentMethod ?? '',
      items: (txn.items ?? []).map((item) => ({
        name: item.product_name,
        qty: item.quantity,
        priceIncludingTax: item.unit_price,
        tenant: item.tenant_name,
        booth: item.booth_location,
      })),
      totalAmount: txn.total_amount,
      note: 'All prices include tax',
    });
    return { success: true };
  } catch (err) {
    const error = err.response?.data?.message ?? err.message ?? 'Unknown error';
    console.error('[sendEReceipt]', error);
    return { success: false, error };
  }
}
