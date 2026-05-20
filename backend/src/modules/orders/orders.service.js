'use strict';

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { generateTxnId }          = require('../../utils/txnId');
const { generateTransactionQR }  = require('../../utils/qrcode');
const { writeAuditLog }          = require('../../utils/auditLog');
const notificationsSvc           = require('../notifications/notifications.service');
const { fireWebhook }            = require('../../utils/webhook');

const PENDING_TIMEOUT_MINUTES = parseInt(process.env.TXN_PENDING_TIMEOUT_MINUTES || '30', 10);

async function _getTaxSettings() {
  try {
    const result = await query("SELECT value FROM system_settings WHERE key = 'tax_config'");
    if (result.rows.length > 0) {
      const cfg = JSON.parse(result.rows[0].value);
      return {
        active: cfg.ppn_active !== false,
        rate:   parseFloat(cfg.ppn_rate) || 12.00,
      };
    }
  } catch { /* ignore — use default */ }
  return { active: true, rate: 12.00 };
}

/**
 * Create a new order from a validated cart.
 * Validates stock, locks rows, decrements stock, creates TXN record.
 *
 * @param {string}   customerId
 * @param {Array}    items   [{ product_id, quantity }]
 * @returns {object} transaction with QR code
 */
async function createOrder(customerId, items) {
  if (!items || items.length === 0) throw new AppError('Keranjang kosong.');

  return withTransaction(async (client) => {
    // 1. Load & lock product rows
    const productIds = items.map(i => i.product_id);
    const productRows = await client.query(
      `SELECT product_id, product_name, price, tenant_id, stock_quantity, stock_status
       FROM products WHERE product_id = ANY($1) AND is_active = TRUE FOR UPDATE`,
      [productIds]
    );

    if (productRows.rows.length !== productIds.length) {
      throw new AppError('Satu atau lebih produk tidak ditemukan.');
    }

    const productMap = Object.fromEntries(productRows.rows.map(p => [p.product_id, p]));

    // 2. Validate stock
    for (const item of items) {
      const p = productMap[item.product_id];
      if (p.stock_status === 'OUT_OF_STOCK' || p.stock_quantity < item.quantity) {
        throw new AppError(`Produk "${p.product_name}" tidak tersedia dalam jumlah yang diminta.`);
      }
    }

    // 3. Calculate totals — read PPN rate from config (falls back to 12%)
    const taxCfg      = await _getTaxSettings();
    const TAX_RATE    = taxCfg.active ? taxCfg.rate : 0;
    const subtotalAmount = items.reduce((sum, item) => {
      return sum + (productMap[item.product_id].price * item.quantity);
    }, 0);
    const taxAmount   = Math.round(subtotalAmount * TAX_RATE / 100);
    const totalAmount = subtotalAmount + taxAmount;

    // 4. Generate TXN ID
    const transactionId = await generateTxnId();
    const expiresAt = new Date(Date.now() + PENDING_TIMEOUT_MINUTES * 60 * 1000);

    // 5. Generate QR payload
    const qrPayload = await generateTransactionQR(transactionId);
    console.log('QR Generated - Length:', qrPayload?.length);

    // 6. Insert transaction
    await client.query(
      `INSERT INTO transactions
         (transaction_id, customer_id, status, subtotal_amount, tax_rate, tax_amount, total_amount, qr_payload, expires_at)
       VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7, $8)`,
      [transactionId, customerId, subtotalAmount, TAX_RATE, taxAmount, totalAmount, qrPayload, expiresAt]
    );

    // 7. Insert items & decrement stock
    for (const item of items) {
      const p = productMap[item.product_id];
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, tenant_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [transactionId, item.product_id, p.tenant_id, item.quantity, p.price, p.price * item.quantity]
      );
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // 8. Audit log
    await writeAuditLog({
      action: 'TXN_CREATED', actorId: customerId, actorRole: 'CUSTOMER',
      entityType: 'TRANSACTION', entityId: transactionId,
      newValue: { customerId, totalAmount, items: items.length },
    });

    console.log('Order created - TXN:', transactionId, 'QR Length:', qrPayload?.length);

    return { transactionId, subtotalAmount, taxRate: TAX_RATE, taxAmount, totalAmount, expiresAt, qrPayload, status: 'PENDING' };
  });
}

/**
 * Get full transaction detail with items.
 */
async function getTransaction(transactionId, requesterId, requesterRole) {
  const txResult = await query(
    `SELECT t.*, c.full_name AS customer_name, c.phone_number AS customer_phone,
            c.email AS customer_email, u.display_name AS cashier_name
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN users u ON u.user_id = t.cashier_id
     WHERE t.transaction_id = $1`,
    [transactionId]
  );
  const txn = txResult.rows[0];
  if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

  // Customers can only see their own transactions
  if (requesterRole === 'CUSTOMER' && txn.customer_id !== requesterId) {
    throw new AppError('Akses ditolak.', 403);
  }

  const itemsResult = await query(
    `SELECT ti.*, p.product_name, p.barcode, p.image_url,
            x.odoo_id AS product_odoo_id,
            ten.tenant_name, ten.booth_location
     FROM transaction_items ti
     JOIN products p ON p.product_id = ti.product_id
     JOIN tenants ten ON ten.tenant_id = ti.tenant_id
     LEFT JOIN integration_xref x
            ON x.entity_type = 'product'
           AND x.sos_id = ti.product_id::text
           AND x.status = 'ACTIVE'
     WHERE ti.transaction_id = $1`,
    [transactionId]
  );

  return { ...txn, items: itemsResult.rows };
}

/**
 * Customer cancels their own PENDING transaction (before cashier processes it).
 */
async function cancelOrder(transactionId, customerId) {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    if (txn.customer_id !== customerId) throw new AppError('Akses ditolak.', 403);
    if (txn.status !== 'PENDING') throw new AppError('Hanya transaksi PENDING yang dapat dibatalkan.');

    // Restore stock
    const items = await client.query(
      `SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1`,
      [transactionId]
    );
    for (const item of items.rows) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query(
      `UPDATE transactions SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = 'Cancelled by customer'
       WHERE transaction_id = $1`,
      [transactionId]
    );

    await writeAuditLog({
      action: 'TXN_CANCELLED', actorId: customerId, actorRole: 'CUSTOMER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: 'PENDING' }, newValue: { status: 'CANCELLED' },
    });

    // Notify integration service (Odoo draft order cancellation)
    fireWebhook('/webhook/order-cancelled', {
      transactionId,
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      customerId,
    });

    return { transactionId, status: 'CANCELLED' };
  });
}

/**
 * Get all orders for a specific customer.
 */
async function getCustomerOrders(customerId) {
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.payment_method,
            t.created_at, t.paid_at,
            COUNT(ti.item_id) AS item_count
     FROM transactions t
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     WHERE t.customer_id = $1
     GROUP BY t.transaction_id
     ORDER BY t.created_at DESC`,
    [customerId]
  );
  return result.rows;
}

/**
 * Customer updates quantity of one item in their own PENDING order.
 * Restores old stock, re-checks and deducts new stock, recalculates total.
 */
async function updateItemQuantity(transactionId, customerId, productId, newQty) {
  return withTransaction(async (client) => {
    // Lock transaction row
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    if (txn.customer_id !== customerId) throw new AppError('Akses ditolak.', 403);
    if (txn.status !== 'PENDING') throw new AppError('Qty hanya bisa diedit pada pesanan PENDING.');

    // Get current item
    const itemResult = await client.query(
      `SELECT * FROM transaction_items WHERE transaction_id = $1 AND product_id = $2`,
      [transactionId, productId]
    );
    const item = itemResult.rows[0];
    if (!item) throw new AppError('Item tidak ditemukan dalam pesanan ini.', 404);

    // Lock product row and check stock
    const productResult = await client.query(
      `SELECT stock_quantity, stock_status FROM products WHERE product_id = $1 FOR UPDATE`,
      [productId]
    );
    const product = productResult.rows[0];
    const availableStock = product.stock_quantity + item.quantity; // restore old qty first
    if (product.stock_status === 'OUT_OF_STOCK' || availableStock < newQty) {
      throw new AppError(`Stok tidak mencukupi. Tersedia: ${availableStock}.`);
    }

    // Update stock: restore old, deduct new (net diff)
    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity + $1 - $2 WHERE product_id = $3`,
      [item.quantity, newQty, productId]
    );

    // Update item row
    await client.query(
      `UPDATE transaction_items SET quantity = $1, subtotal = $2 WHERE transaction_id = $3 AND product_id = $4`,
      [newQty, item.unit_price * newQty, transactionId, productId]
    );

    // Recalculate transaction total — keep original tax_rate from the order
    const totalResult = await client.query(
      `SELECT SUM(subtotal) AS subtotal, tax_rate
       FROM transaction_items ti
       JOIN transactions t ON t.transaction_id = ti.transaction_id
       WHERE ti.transaction_id = $1
       GROUP BY t.tax_rate`,
      [transactionId]
    );
    const newSubtotal  = parseFloat(totalResult.rows[0].subtotal);
    const txnTaxRate   = parseFloat(totalResult.rows[0].tax_rate ?? 12);
    const newTaxAmount = Math.round(newSubtotal * txnTaxRate / 100);
    const newTotal     = newSubtotal + newTaxAmount;
    await client.query(
      `UPDATE transactions SET subtotal_amount = $1, tax_amount = $2, total_amount = $3
       WHERE transaction_id = $4`,
      [newSubtotal, newTaxAmount, newTotal, transactionId]
    );

    await writeAuditLog({
      action: 'TXN_ITEM_UPDATED', actorId: customerId, actorRole: 'CUSTOMER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { productId, quantity: item.quantity },
      newValue: { productId, quantity: newQty },
    });

    return { transactionId, productId, quantity: newQty, total_amount: newTotal };
  });
}

module.exports = { createOrder, getTransaction, cancelOrder, getCustomerOrders, updateItemQuantity };
