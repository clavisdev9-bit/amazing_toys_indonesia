'use strict';

const fs   = require('fs');
const path = require('path');

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { generateTxnId }          = require('../../utils/txnId');
const { generateTransactionQR }  = require('../../utils/qrcode');
const { writeAuditLog }          = require('../../utils/auditLog');
const notificationsSvc           = require('../notifications/notifications.service');
const { fireWebhook }            = require('../../utils/webhook');
const voucherSvc                 = require('../vouchers/vouchers.service');
const { broadcastToTenant, broadcastToCustomer } = require('../../ws/websocket');
const logger                     = require('../../config/logger');

const _SYSTEM_CONFIG_PATH = path.join(__dirname, '../../../data/system-config.json');
const _ENV_TIMEOUT = parseInt(process.env.TXN_PENDING_TIMEOUT_MINUTES || '30', 10);

function _getCheckoutTimeoutMinutes() {
  try {
    const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
    const val = parseInt(cfg.txn_timeout_checkout, 10);
    return (Number.isFinite(val) && val > 0) ? val : _ENV_TIMEOUT;
  } catch {
    return _ENV_TIMEOUT;
  }
}

function _getMaxItemsPerOrder() {
  try {
    const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
    const val = parseInt(cfg.max_items_per_order, 10);
    return (Number.isFinite(val) && val > 0) ? val : 20;
  } catch {
    return 20;
  }
}

function _getOrderMode() {
  try {
    const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
    return cfg.order_mode || 'HELPER_INPUT';
  } catch {
    return 'HELPER_INPUT';
  }
}

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
 * @param {string}      customerId
 * @param {Array}       items         [{ product_id, quantity }]
 * @param {string|null} voucherCode   optional voucher code
 * @returns {object} transaction with QR code
 */
async function createOrder(customerId, items, voucherCode = null) {
  const orderMode = _getOrderMode();

  if (orderMode === 'HELPER_INPUT') {
    throw new AppError('Pemesanan mandiri tidak tersedia. Hubungi petugas booth untuk melakukan pesanan.', 403);
  }

  if (!items || items.length === 0) throw new AppError('Keranjang kosong.');

  const maxItems = _getMaxItemsPerOrder();
  const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
  if (totalQty > maxItems) {
    throw new AppError(`Maksimal ${maxItems} item per order. Total saat ini: ${totalQty} item.`, 422);
  }

  // CR-040: In HELPER_APPROVE mode orders wait for helper approval — stock is NOT reserved yet.
  const isHelperApproveMode = orderMode === 'HELPER_APPROVE';

  const result = await withTransaction(async (client) => {
    // 1. Load product rows — lock only if we'll deduct stock immediately
    const productIds = items.map(i => i.product_id);
    const lockClause = isHelperApproveMode ? '' : ' FOR UPDATE';
    const productRows = await client.query(
      `SELECT product_id, product_name, price, tenant_id, stock_quantity, stock_status, is_preorder
       FROM products WHERE product_id = ANY($1) AND is_active = TRUE${lockClause}`,
      [productIds]
    );

    if (productRows.rows.length !== productIds.length) {
      throw new AppError('Satu atau lebih produk tidak ditemukan.');
    }

    const productMap = Object.fromEntries(productRows.rows.map(p => [p.product_id, p]));

    // CR-056: Universal mixed cart defense — applies to ALL order modes.
    const preorderItemsAll = items.filter(i => productMap[i.product_id]?.is_preorder);
    if (preorderItemsAll.length > 0 && preorderItemsAll.length !== items.length) {
      throw new AppError(
        'Pre-Order tidak bisa digabung dengan produk reguler. Buat order terpisah.',
        400,
      );
    }

    // CR-038 + CR-050: In SELF_ORDER mode, reject on-hold AND pre-order items.
    // Pre-order requires Helper to collect shipping info — cannot be self-ordered.
    // Frontend filters these, but this is the safety net for race conditions.
    if (!isHelperApproveMode) {
      if (preorderItemsAll.length > 0) {
        const names = preorderItemsAll.map(i => productMap[i.product_id].product_name).join(', ');
        throw new AppError(
          `Produk pre-order tidak bisa dipesan mandiri: ${names}. ` +
          `Silakan minta bantuan Helper untuk memproses order pre-order.`,
          422,
          { preorderProductIds: preorderItemsAll.map(i => i.product_id) },
        );
      }

      const onHoldCheck = await client.query(
        `SELECT product_id, product_name FROM products
         WHERE product_id = ANY($1) AND is_on_hold = TRUE`,
        [productIds],
      );
      if (onHoldCheck.rows.length > 0) {
        const names = onHoldCheck.rows.map(r => r.product_name).join(', ');
        throw new AppError(
          `Beberapa produk belum tersedia untuk dipesan: ${names}. ` +
          `Silakan hapus dari keranjang atau tanyakan langsung ke booth.`,
          422,
          { onHoldProductIds: onHoldCheck.rows.map(r => r.product_id) },
        );
      }
    }

    // 2. Validate stock (skip for pre-order items — they never deduct stock)
    for (const item of items) {
      const p = productMap[item.product_id];
      if (p.is_preorder) continue;
      if (p.stock_status === 'OUT_OF_STOCK' || p.stock_quantity < item.quantity) {
        throw new AppError(`Produk "${p.product_name}" tidak tersedia dalam jumlah yang diminta.`);
      }
    }

    // 3. Calculate totals
    const taxCfg         = await _getTaxSettings();
    const TAX_RATE       = taxCfg.active ? taxCfg.rate : 0;
    const subtotalAmount = items.reduce((sum, item) => {
      return sum + (productMap[item.product_id].price * item.quantity);
    }, 0);

    let discountAmount = 0;
    if (voucherCode) {
      const tenantIds = [...new Set(items.map(i => productMap[i.product_id]?.tenant_id).filter(Boolean))];
      const resolvedItems = items.map(i => ({
        price:     productMap[i.product_id].price,
        quantity:  i.quantity,
        tenant_id: productMap[i.product_id].tenant_id,
      }));
      const vResult = await voucherSvc.validateVoucher({
        code: voucherCode,
        customerId,
        cartTotal: subtotalAmount,
        tenantIds,
        items: resolvedItems,
      });
      discountAmount = vResult.discount_amount;
    }

    const taxableAmount = subtotalAmount - discountAmount;
    const taxAmount     = Math.round(taxableAmount * TAX_RATE / 100);
    const totalAmount   = taxableAmount + taxAmount;

    // 4. Generate TXN ID
    const transactionId = await generateTxnId();

    // CR-041 GAP 3: HELPER_APPROVE — timer must NOT start until helper approves.
    // expires_at stays NULL until approveOrder() sets it. Column allows NULL (migration 016).
    const expiresAt = isHelperApproveMode
      ? null
      : new Date(Date.now() + _getCheckoutTimeoutMinutes() * 60 * 1000);

    // 5. Generate QR payload (used after approval in SELF_ORDER; skipped in HELPER_APPROVE until approved)
    let qrPayload = null;
    if (!isHelperApproveMode) {
      qrPayload = await generateTransactionQR(transactionId);
      console.log('QR Generated - Length:', qrPayload?.length);
    }

    // 6. Determine initial status and order type
    const initialStatus = isHelperApproveMode ? 'PENDING_APPROVAL' : 'PENDING';
    const isPreorderCart = items.some(i => productMap[i.product_id]?.is_preorder);
    const orderType = isPreorderCart ? 'PREORDER' : 'REGULAR';

    // 7. Insert transaction
    await client.query(
      `INSERT INTO transactions
         (transaction_id, customer_id, status, order_type, subtotal_amount, tax_rate, tax_amount, total_amount,
          voucher_code, discount_amount, qr_payload, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [transactionId, customerId, initialStatus, orderType, subtotalAmount, TAX_RATE, taxAmount, totalAmount,
       voucherCode || null, discountAmount, qrPayload, expiresAt]
    );

    // 8. Insert items
    for (const item of items) {
      const p = productMap[item.product_id];
      await client.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, tenant_id, quantity, unit_price, subtotal, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [transactionId, item.product_id, p.tenant_id, item.quantity, p.price,
         p.price * item.quantity, isHelperApproveMode ? 'PENDING' : 'APPROVED']
      );

      // Deduct stock immediately only in SELF_ORDER mode (never for pre-order — invariant CR-050)
      if (!isHelperApproveMode && !p.is_preorder) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    // 9. Record voucher usage — only when stock is immediately reserved
    if (!isHelperApproveMode && voucherCode && discountAmount > 0) {
      try {
        await voucherSvc.applyVoucher({
          code: voucherCode,
          transactionId,
          customerId,
          discountAmount,
          client,
        });
      } catch (vErr) {
        throw new AppError(
          `Voucher tidak lagi tersedia, silakan coba tanpa voucher. (${vErr.message})`,
          409
        );
      }
    }

    // 10. Audit log
    await writeAuditLog({
      action: 'TXN_CREATED', actorId: customerId, actorRole: 'CUSTOMER',
      entityType: 'TRANSACTION', entityId: transactionId,
      newValue: { customerId, totalAmount, items: items.length, discountAmount, voucherCode, status: initialStatus, orderType },
    });

    console.log('Order created - TXN:', transactionId, 'Status:', initialStatus);

    // CR-040: notify helper channel that a new approval request arrived
    if (isHelperApproveMode) {
      const tenantId = productMap[items[0].product_id]?.tenant_id;
      if (tenantId) {
        try {
          broadcastToTenant(tenantId, {
            event:         'PENDING_APPROVAL_CREATED',
            transactionId,
            totalAmount,
            itemCount:     items.length,
          });
        } catch (e) {
          logger.warn('WS PENDING_APPROVAL_CREATED broadcast failed', { error: e.message });
        }
      }
    }

    return {
      transactionId, subtotalAmount, taxRate: TAX_RATE, taxAmount, totalAmount,
      discountAmount, voucherCode: voucherCode || null, expiresAt,
      qrPayload: qrPayload || null,
      status: initialStatus,
    };
  });

  return result;
}

/**
 * Get full transaction detail with items.
 */
async function getTransaction(transactionId, requesterId, requesterRole) {
  const txResult = await query(
    `SELECT t.*, c.full_name AS customer_name, c.phone_number AS customer_phone,
            c.email AS customer_email, u.display_name AS cashier_name,
            v.tenant_id AS voucher_tenant_id
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN users u ON u.user_id = t.cashier_id
     LEFT JOIN vouchers v ON v.code = t.voucher_code
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
    if (!['PENDING', 'PENDING_APPROVAL'].includes(txn.status)) {
      throw new AppError('Hanya transaksi PENDING atau PENDING_APPROVAL yang dapat dibatalkan.');
    }

    // Restore stock only if it was already deducted (PENDING, not PENDING_APPROVAL)
    if (txn.status === 'PENDING') {
      const items = await client.query(
        `SELECT product_id, quantity, approval_status, approved_quantity
         FROM transaction_items WHERE transaction_id = $1`,
        [transactionId]
      );
      for (const item of items.rows) {
        // BUG-059: use approved_quantity for APPROVED items — only that portion was
        // deducted when helper called approveItem(). The rejected portion (quantity -
        // approved_quantity) was never deducted in the PENDING_APPROVAL flow.
        // For pure self-order items (approval_status='PENDING', approved_quantity=NULL),
        // full quantity was deducted at order creation → restore quantity.
        const restoreQty = item.approval_status === 'REJECTED'
          ? 0
          : (item.approved_quantity !== null ? item.approved_quantity : item.quantity);
        if (restoreQty > 0) {
          await client.query(
            `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
            [restoreQty, item.product_id]
          );
        }
      }
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

/**
 * Customer removes one item from their own PENDING order.
 * Restores stock, recalculates totals.
 * If it is the last item, the order is automatically cancelled.
 */
async function removeOrderItem(transactionId, customerId, productId) {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    if (txn.customer_id !== customerId) throw new AppError('Akses ditolak.', 403);
    if (txn.status !== 'PENDING') throw new AppError('Item hanya bisa dihapus pada pesanan PENDING.');

    const itemResult = await client.query(
      `SELECT * FROM transaction_items WHERE transaction_id = $1 AND product_id = $2`,
      [transactionId, productId]
    );
    const item = itemResult.rows[0];
    if (!item) throw new AppError('Item tidak ditemukan dalam pesanan ini.', 404);

    // Restore stock
    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
      [item.quantity, productId]
    );

    // Delete item row
    await client.query(
      `DELETE FROM transaction_items WHERE transaction_id = $1 AND product_id = $2`,
      [transactionId, productId]
    );

    // Check remaining items
    const remainingResult = await client.query(
      `SELECT COUNT(*) AS cnt FROM transaction_items WHERE transaction_id = $1`,
      [transactionId]
    );
    const remainingCount = parseInt(remainingResult.rows[0].cnt, 10);

    if (remainingCount === 0) {
      // Last item deleted — cancel the order automatically
      await client.query(
        `UPDATE transactions SET status = 'CANCELLED', cancelled_at = NOW(),
         cancellation_reason = 'Semua item dihapus oleh customer'
         WHERE transaction_id = $1`,
        [transactionId]
      );
      await writeAuditLog({
        action: 'TXN_ITEM_REMOVED', actorId: customerId, actorRole: 'CUSTOMER',
        entityType: 'TRANSACTION', entityId: transactionId,
        oldValue: { productId, quantity: item.quantity },
        newValue: { deleted: true, orderCancelled: true },
      });
      fireWebhook('/webhook/order-cancelled', {
        transactionId, status: 'CANCELLED',
        cancelledAt: new Date().toISOString(), customerId,
      });
      return { transactionId, productId, deleted: true, orderCancelled: true };
    }

    // Recalculate transaction total
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
      action: 'TXN_ITEM_REMOVED', actorId: customerId, actorRole: 'CUSTOMER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { productId, quantity: item.quantity },
      newValue: { deleted: true, total_amount: newTotal },
    });

    return { transactionId, productId, deleted: true, total_amount: newTotal };
  });
}

/**
 * Create a walk-in order on behalf of a cashier.
 * Uses a reserved walk-in customer so the transactions FK is satisfied.
 *
 * @param {string}      cashierId
 * @param {Array}       items
 * @param {string|null} voucherCode  optional voucher code
 */
async function createOrderByCashier(cashierId, items, voucherCode = null, customerPhone = null) {
  if (!items || items.length === 0) throw new AppError('Keranjang kosong.');

  const maxItems = _getMaxItemsPerOrder();
  const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
  if (totalQty > maxItems) {
    throw new AppError(`Maksimal ${maxItems} item per order. Total saat ini: ${totalQty} item.`, 422);
  }

  return withTransaction(async (client) => {
    // Resolve customer: if cashier provided a phone, look up or lazily-create that customer.
    // Otherwise use the shared Walk-in sentinel (0000000000).
    const WALKIN_PHONE = '0000000000';
    const lookupPhone  = (customerPhone && customerPhone.trim()) ? customerPhone.trim() : WALKIN_PHONE;
    const isWalkIn     = lookupPhone === WALKIN_PHONE;

    let custRes = await client.query(
      `SELECT customer_id FROM customers WHERE phone_number = $1`,
      [lookupPhone]
    );
    if (custRes.rows.length === 0) {
      custRes = await client.query(
        `INSERT INTO customers (full_name, phone_number, email, gender)
         VALUES ($1, $2, NULL, 'PREFER_NOT_TO_SAY')
         RETURNING customer_id`,
        [isWalkIn ? 'Walk-in Customer' : `Customer ${lookupPhone}`, lookupPhone]
      );
    }
    const customerId = custRes.rows[0].customer_id;

    // 1. Load & lock products
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

    // 3. Calculate totals — PPN dihitung pada (subtotal - diskon)
    const taxCfg         = await _getTaxSettings();
    const TAX_RATE       = taxCfg.active ? taxCfg.rate : 0;
    const subtotalAmount = items.reduce((sum, item) => sum + productMap[item.product_id].price * item.quantity, 0);

    let discountAmount = 0;
    if (voucherCode) {
      const tenantIds = [...new Set(items.map(i => productMap[i.product_id]?.tenant_id).filter(Boolean))];
      const resolvedItems = items.map(i => ({
        price:     productMap[i.product_id].price,
        quantity:  i.quantity,
        tenant_id: productMap[i.product_id].tenant_id,
      }));
      const vResult = await voucherSvc.validateVoucher({
        code: voucherCode,
        customerId,
        cartTotal: subtotalAmount,
        tenantIds,
        items: resolvedItems,
      });
      discountAmount = vResult.discount_amount;
    }

    const taxableAmount = subtotalAmount - discountAmount;
    const taxAmount     = Math.round(taxableAmount * TAX_RATE / 100);
    const totalAmount   = taxableAmount + taxAmount;

    // 4. Generate IDs
    const transactionId = await generateTxnId();
    const expiresAt = new Date(Date.now() + _getCheckoutTimeoutMinutes() * 60 * 1000);
    const qrPayload = await generateTransactionQR(transactionId);

    // 5. Insert transaction with cashier_id pre-filled
    await client.query(
      `INSERT INTO transactions
         (transaction_id, customer_id, cashier_id, status, subtotal_amount, tax_rate, tax_amount, total_amount,
          voucher_code, discount_amount, qr_payload, expires_at)
       VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, $8, $9, $10, $11)`,
      [transactionId, customerId, cashierId, subtotalAmount, TAX_RATE, taxAmount, totalAmount,
       voucherCode || null, discountAmount, qrPayload, expiresAt]
    );

    // 6. Insert items & decrement stock
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

    // 7. Record voucher usage (within same DB transaction)
    if (voucherCode && discountAmount > 0) {
      try {
        await voucherSvc.applyVoucher({
          code: voucherCode,
          transactionId,
          customerId,
          discountAmount,
          client,
        });
      } catch (vErr) {
        throw new AppError(
          `Voucher tidak lagi tersedia, silakan coba tanpa voucher. (${vErr.message})`,
          409
        );
      }
    }

    await writeAuditLog({
      action: 'TXN_CREATED', actorId: cashierId, actorRole: 'CASHIER',
      entityType: 'TRANSACTION', entityId: transactionId,
      newValue: { cashierId, customerId, totalAmount, items: items.length, discountAmount, voucherCode },
    });

    return { transactionId, subtotalAmount, taxRate: TAX_RATE, taxAmount, totalAmount, discountAmount, voucherCode: voucherCode || null, expiresAt, qrPayload, status: 'PENDING' };
  });
}

/**
 * Cashier adds (or increments) an item on an existing PENDING transaction.
 */
async function addItemToTransaction(transactionId, cashierId, productId, quantity) {
  return withTransaction(async (client) => {
    // Lock transaction
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    const CASHIER_EDITABLE = ['PENDING', 'RESERVED', 'WAITING_PAYMENT'];
    if (!CASHIER_EDITABLE.includes(txn.status)) throw new AppError(`Hanya transaksi aktif (${CASHIER_EDITABLE.join('/')}) yang dapat diubah. Status saat ini: ${txn.status}.`, 422);

    // Lock product
    const productResult = await client.query(
      `SELECT product_id, product_name, price, tenant_id, stock_quantity, stock_status
       FROM products WHERE product_id = $1 AND is_active = TRUE FOR UPDATE`,
      [productId]
    );
    const product = productResult.rows[0];
    if (!product) throw new AppError('Produk tidak ditemukan.', 404);
    if (product.stock_status === 'OUT_OF_STOCK' || product.stock_quantity < quantity) {
      throw new AppError(`Stok "${product.product_name}" tidak mencukupi.`);
    }

    // Check max items per order (total qty across all items + net addition)
    const currentTotals = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM transaction_items WHERE transaction_id = $1`,
      [transactionId]
    );
    const existingForProduct = await client.query(
      `SELECT quantity FROM transaction_items WHERE transaction_id = $1 AND product_id = $2`,
      [transactionId, productId]
    );
    const currentTotal = parseInt(currentTotals.rows[0].total_qty, 10);
    const netAddition  = quantity; // upsert: we add on top of existing qty
    const maxItems     = _getMaxItemsPerOrder();
    if (currentTotal + netAddition > maxItems) {
      throw new AppError(
        `Maksimal ${maxItems} item per order. Saat ini sudah ${currentTotal} item, tidak bisa tambah ${netAddition} lagi.`,
        422
      );
    }

    // Upsert item
    const existing = existingForProduct;
    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity + quantity;
      await client.query(
        `UPDATE transaction_items SET quantity = $1, subtotal = $2 WHERE transaction_id = $3 AND product_id = $4`,
        [newQty, product.price * newQty, transactionId, productId]
      );
    } else {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, tenant_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [transactionId, productId, product.tenant_id, quantity, product.price, product.price * quantity]
      );
    }

    // Decrement stock
    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2`,
      [quantity, productId]
    );

    // Recalculate totals
    const totalResult = await client.query(
      `SELECT SUM(subtotal) AS subtotal, t.tax_rate
       FROM transaction_items ti
       JOIN transactions t ON t.transaction_id = ti.transaction_id
       WHERE ti.transaction_id = $1
       GROUP BY t.tax_rate`,
      [transactionId]
    );
    const newSubtotal  = parseFloat(totalResult.rows[0].subtotal);
    const taxRate      = parseFloat(totalResult.rows[0].tax_rate ?? 12);
    const newTaxAmount = Math.round(newSubtotal * taxRate / 100);
    const newTotal     = newSubtotal + newTaxAmount;

    await client.query(
      `UPDATE transactions SET subtotal_amount = $1, tax_amount = $2, total_amount = $3 WHERE transaction_id = $4`,
      [newSubtotal, newTaxAmount, newTotal, transactionId]
    );

    await writeAuditLog({
      action: 'ADD_ITEM', actorId: cashierId, actorRole: 'CASHIER',
      entityType: 'TRANSACTION', entityId: transactionId,
      newValue: {
        product_id:   productId,
        product_name: product.product_name,
        qty:          quantity,
        subtotal:     product.price * quantity,
        total_before: parseFloat(txn.total_amount),
        total_after:  newTotal,
      },
    });

    return { transactionId, total_amount: newTotal };
  });
}

/**
 * Apply a voucher to an existing PENDING transaction (cashier/payment screen).
 * Recalculates tax_amount and total_amount after applying discount.
 */
async function applyVoucherToTransaction(transactionId, cashierId, voucherCode) {
  return withTransaction(async (client) => {
    // 1. Lock & validate transaction
    const txResult = await client.query(
      `SELECT transaction_id, status, customer_id, subtotal_amount, tax_rate, voucher_code
       FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    if (txResult.rows.length === 0) throw new AppError('Transaksi tidak ditemukan.', 404);
    const txn = txResult.rows[0];
    const CASHIER_EDITABLE_V = ['PENDING', 'RESERVED', 'WAITING_PAYMENT'];
    if (!CASHIER_EDITABLE_V.includes(txn.status)) throw new AppError(`Voucher hanya dapat diterapkan pada transaksi aktif (${CASHIER_EDITABLE_V.join('/')}). Status saat ini: ${txn.status}.`, 422);
    if (txn.voucher_code) throw new AppError('Transaksi sudah memiliki voucher yang diterapkan.', 409);

    // 2. Get items for tenant-scoped validation
    const itemsRes = await client.query(
      `SELECT ti.tenant_id, ti.unit_price AS price, ti.quantity
       FROM transaction_items ti WHERE ti.transaction_id = $1`,
      [transactionId]
    );
    const items     = itemsRes.rows;
    const tenantIds = [...new Set(items.map(i => i.tenant_id).filter(Boolean))];
    const cartTotal = parseFloat(txn.subtotal_amount);

    // 3. Validate voucher
    const vResult = await voucherSvc.validateVoucher({
      code:       voucherCode,
      customerId: txn.customer_id,
      cartTotal,
      tenantIds,
      items: items.map(i => ({ price: parseFloat(i.price), quantity: i.quantity, tenant_id: i.tenant_id })),
    });
    const discountAmount = vResult.discount_amount;

    // 4. Recalculate totals
    const taxRate      = parseFloat(txn.tax_rate) || 0;
    const taxableAmt   = cartTotal - discountAmount;
    const taxAmount    = Math.round(taxableAmt * taxRate / 100);
    const totalAmount  = taxableAmt + taxAmount;

    // 5. Persist voucher on transaction
    await client.query(
      `UPDATE transactions
          SET voucher_code = $1, discount_amount = $2, tax_amount = $3, total_amount = $4
        WHERE transaction_id = $5`,
      [voucherCode, discountAmount, taxAmount, totalAmount, transactionId]
    );

    // 6. Record usage (atomic — rolls back the whole txn on race condition)
    try {
      await voucherSvc.applyVoucher({
        code: voucherCode,
        transactionId,
        customerId: txn.customer_id,
        discountAmount,
        client,
      });
    } catch (vErr) {
      throw new AppError(`Voucher tidak lagi tersedia. (${vErr.message})`, 409);
    }

    await writeAuditLog({
      action: 'VOUCHER_APPLIED', actorId: cashierId, actorRole: 'CASHIER',
      entityType: 'TRANSACTION', entityId: transactionId,
      newValue: { voucherCode, discountAmount, totalAmount },
    });

    return { transactionId, voucherCode, discountAmount, taxAmount, totalAmount };
  });
}

/**
 * Customer triggers partial checkout: approved booth items proceed to PENDING,
 * unapproved items are saved to wishlist and removed from the transaction.
 */
async function partialProcessOrder(transactionId, customerId) {
  const committed = await withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId],
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    if (txn.status !== 'PENDING_APPROVAL') {
      throw new AppError('Hanya transaksi PENDING_APPROVAL yang bisa diproses sebagian.', 409);
    }
    if (txn.customer_id !== customerId) throw new AppError('Akses ditolak.', 403);

    const itemsRes = await client.query(
      `SELECT ti.*, p.product_name FROM transaction_items ti
       JOIN products p ON p.product_id = ti.product_id
       WHERE ti.transaction_id = $1`,
      [transactionId],
    );
    const allItems     = itemsRes.rows;
    const approvedItems = allItems.filter(i => i.approval_status === 'APPROVED');
    const pendingItems  = allItems.filter(i => i.approval_status !== 'APPROVED');

    if (approvedItems.length === 0) {
      throw new AppError('Belum ada item yang disetujui.', 409);
    }

    if (pendingItems.length > 0) {
      for (const item of pendingItems) {
        await client.query(
          `INSERT INTO wishlists (customer_id, product_id)
           VALUES ($1, $2)
           ON CONFLICT (customer_id, product_id) DO NOTHING`,
          [customerId, item.product_id],
        );
      }
      await client.query(
        `DELETE FROM transaction_items
         WHERE transaction_id = $1 AND approval_status != 'APPROVED'`,
        [transactionId],
      );
    }

    const subtotalAmount = approvedItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
    const taxRate        = parseFloat(txn.tax_rate) || 0;
    const taxAmount      = Math.round(subtotalAmount * taxRate / 100);
    const totalAmount    = subtotalAmount + taxAmount;
    const expiresAt      = new Date(Date.now() + _getCheckoutTimeoutMinutes() * 60 * 1000);

    await client.query(
      `UPDATE transactions SET
         subtotal_amount = $1,
         tax_amount      = $2,
         total_amount    = $3,
         status          = 'PENDING',
         approved_at     = NOW(),
         expires_at      = $4
       WHERE transaction_id = $5`,
      [subtotalAmount, taxAmount, totalAmount, expiresAt, transactionId],
    );

    await writeAuditLog({
      action: 'TXN_PARTIAL_PROCESSED', actorId: customerId, actorRole: 'CUSTOMER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: 'PENDING_APPROVAL' },
      newValue: {
        status: 'PENDING',
        approvedItems: approvedItems.length,
        savedToWishlist: pendingItems.length,
      },
    });

    return { customerId, expiresAt, approvedItems, savedToWishlist: pendingItems };
  });

  // Phase 2: QR generation (non-critical)
  let qrPayload = null;
  try {
    qrPayload = await generateTransactionQR(transactionId);
    if (qrPayload) {
      await query(
        `UPDATE transactions SET qr_payload = $1 WHERE transaction_id = $2`,
        [qrPayload, transactionId],
      );
    }
  } catch (qrErr) {
    logger.error('[partialProcessOrder] QR generation failed', { transactionId, error: qrErr.message });
  }

  // Phase 3: notify customer so page auto-refreshes to PENDING+QR
  try {
    broadcastToCustomer(committed.customerId, {
      event:         'ORDER_APPROVED',
      transactionId,
      expiresAt:     committed.expiresAt,
      qrPayload,
      message:       'Pesanan Anda sedang diproses. Silakan lakukan pembayaran.',
    });
  } catch (e) { logger.warn('WS ORDER_APPROVED broadcast failed', { error: e.message }); }

  return {
    transactionId,
    approvedItems:   committed.approvedItems,
    savedToWishlist: committed.savedToWishlist,
    expiresAt:       committed.expiresAt,
  };
}

module.exports = { createOrder, createOrderByCashier, addItemToTransaction, applyVoucherToTransaction, getTransaction, cancelOrder, getCustomerOrders, updateItemQuantity, removeOrderItem, partialProcessOrder };
