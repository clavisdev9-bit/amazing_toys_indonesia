'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { generateTxnId }          = require('../../utils/txnId');
const { generateTransactionQR }  = require('../../utils/qrcode');
const { writeAuditLog }          = require('../../utils/auditLog');
const { validateTransition }     = require('../orders/status.machine');
const { broadcastToTenant, broadcastToAll, broadcastToCustomer } = require('../../ws/websocket');
const logger                     = require('../../config/logger');
const waSvc                      = require('../wa/wa.service');

const _SYSTEM_CONFIG_PATH = path.join(__dirname, '../../../data/system-config.json');

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
      return { active: cfg.ppn_active !== false, rate: parseFloat(cfg.ppn_rate) || 12.00 };
    }
  } catch { /* ignore — use default */ }
  return { active: true, rate: 12.00 };
}

/**
 * Create a RESERVED order on behalf of a customer.
 * Only callable by HELPER role; stock is locked atomically.
 * CR-036: setelah INSERT RESERVED, generate public_token + trigger WA (Layer 1) + WS (Layer 2).
 *
 * @param {object} opts
 * @param {string}   opts.helperId        UUID of the HELPER user
 * @param {string}   opts.helperTenantId  Tenant/booth ID bound to this helper
 * @param {Array}    opts.items           [{ product_id, qty }]
 * @param {string}   [opts.customerPhone] Walk-in phone (optional)
 * @param {string}   [opts.customerId]    UUID if customer has an account
 * @returns {object} transaction record with QR payload + Layer delivery status
 */
async function createHelperOrder({ helperId, helperTenantId, items, customerPhone, customerId }) {
  if (!items || items.length === 0) throw new AppError('Pilih minimal satu produk.', 422);
  if (!helperTenantId) throw new AppError('Helper tidak terikat ke booth manapun.', 403);

  // Baca WA config di luar transaction (read-only; tidak perlu lock DB)
  const waConfig       = await waSvc.getWaConfig();
  const tokenTtlMinutes = waConfig.ttlMinutes || 120;

  const txResult = await withTransaction(async (client) => {
    // 1. Lock & load products — must all belong to this helper's booth
    const productIds = items.map(i => i.product_id);
    const productRows = await client.query(
      `SELECT product_id, product_name, price, tenant_id, stock_quantity, stock_status,
              is_display_only, is_on_hold, max_per_customer, bundle_group
       FROM products
       WHERE product_id = ANY($1) AND tenant_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [productIds, helperTenantId],
    );

    if (productRows.rows.length !== productIds.length) {
      throw new AppError('Satu atau lebih produk tidak ditemukan, tidak aktif, atau bukan milik booth Anda.', 404);
    }

    const productMap = Object.fromEntries(productRows.rows.map(p => [p.product_id, p]));

    // 2. Booth ownership + booth rule validation
    for (const item of items) {
      const p = productMap[item.product_id];
      if (p.tenant_id !== helperTenantId) {
        throw new AppError(`Produk "${p.product_name}" bukan milik booth ini.`, 403);
      }
      if (p.is_display_only) {
        throw new AppError(`Produk "${p.product_name}" hanya untuk display — tidak bisa dijual.`, 400);
      }
      if (p.is_on_hold) {
        throw new AppError(`Produk "${p.product_name}" sedang di-hold oleh artist.`, 400);
      }
      if (p.max_per_customer !== null && item.qty > p.max_per_customer) {
        throw new AppError(
          `Produk "${p.product_name}" maksimal ${p.max_per_customer} per customer.`,
          400,
        );
      }
    }

    // 3. Bundle group check
    const bundleGroups = [...new Set(
      productRows.rows.filter(p => p.bundle_group).map(p => p.bundle_group),
    )];
    if (bundleGroups.length > 0) {
      const bundleCheck = await client.query(
        `SELECT product_id, bundle_group FROM products
         WHERE bundle_group = ANY($1) AND is_active = TRUE AND tenant_id = $2`,
        [bundleGroups, helperTenantId],
      );
      const requiredByGroup = {};
      for (const row of bundleCheck.rows) {
        if (!requiredByGroup[row.bundle_group]) requiredByGroup[row.bundle_group] = [];
        requiredByGroup[row.bundle_group].push(row.product_id);
      }
      for (const [grp, required] of Object.entries(requiredByGroup)) {
        const missing = required.filter(r => !productIds.includes(r));
        if (missing.length > 0) {
          throw new AppError(
            `Bundle group "${grp}" tidak lengkap — tambahkan produk: ${missing.join(', ')}`,
            400,
          );
        }
      }
    }

    // 4. Stock check
    for (const item of items) {
      const p = productMap[item.product_id];
      if (p.stock_quantity < item.qty) {
        throw new AppError(
          `Stok "${p.product_name}" tidak mencukupi (tersedia: ${p.stock_quantity}, diminta: ${item.qty}).`,
          409,
        );
      }
    }

    // 5. Calculate totals
    const taxCfg      = await _getTaxSettings();
    const TAX_RATE    = taxCfg.active ? taxCfg.rate : 0;
    const subtotal    = items.reduce((s, i) => s + productMap[i.product_id].price * i.qty, 0);
    const taxAmount   = Math.round(subtotal * TAX_RATE / 100);
    const totalAmount = subtotal + taxAmount;

    // 6. CR-036: Resolve customerId + effective phone.
    //    Step A — if only phone given, reverse-lookup to find a registered customer.
    //    Step B — if customerId known, prefer their registered phone over walk-in input.
    let effectivePhone = customerPhone || null;

    if (!customerId && effectivePhone) {
      try {
        const custRow = await client.query(
          'SELECT customer_id FROM customers WHERE phone_number = $1',
          [effectivePhone],
        );
        if (custRow.rows[0]?.customer_id) {
          customerId = custRow.rows[0].customer_id; // eslint-disable-line no-param-reassign
        }
      } catch { /* walk-in — no registered account found */ }
    }

    if (customerId) {
      try {
        const custRow = await client.query(
          'SELECT phone_number FROM customers WHERE customer_id = $1',
          [customerId],
        );
        if (custRow.rows[0]?.phone_number) {
          effectivePhone = custRow.rows[0].phone_number;
        }
      } catch { /* keep walk-in phone */ }
    }

    // 7. CR-036: Generate public token
    const publicToken    = crypto.randomUUID();
    const publicTokenExp = new Date(Date.now() + tokenTtlMinutes * 60 * 1000);

    // 8. Generate IDs & QR
    const transactionId = await generateTxnId();
    const qrPayload     = await generateTransactionQR(transactionId);
    const expiresAt     = new Date(Date.now() + 2 * 60 * 60 * 1000);

    // 9. Insert transaction (RESERVED) — CR-036 kolom ikut di INSERT
    await client.query(
      `INSERT INTO transactions
         (transaction_id, customer_id, customer_phone, status,
          subtotal_amount, tax_rate, tax_amount, total_amount,
          qr_payload, expires_at,
          created_by_role, created_by_user, reserved_at,
          public_token, public_token_exp, wa_delivery_status)
       VALUES ($1, $2, $3, 'RESERVED',
               $4, $5, $6, $7,
               $8, $9,
               'HELPER', $10, NOW(),
               $11, $12, 'PENDING')`,
      [
        transactionId,
        customerId    || null,
        effectivePhone || null,
        subtotal, TAX_RATE, taxAmount, totalAmount,
        qrPayload, expiresAt,
        helperId,
        publicToken, publicTokenExp,
      ],
    );

    // 10. Insert items & decrement stock atomically
    for (const item of items) {
      const p = productMap[item.product_id];
      await client.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, tenant_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [transactionId, item.product_id, p.tenant_id, item.qty, p.price, p.price * item.qty],
      );
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2`,
        [item.qty, item.product_id],
      );
    }

    await writeAuditLog({
      action: 'TXN_RESERVED', actorId: helperId, actorRole: 'HELPER',
      entityType: 'TRANSACTION', entityId: transactionId,
      newValue: { helperTenantId, customerId, customerPhone: effectivePhone, totalAmount, items: items.length },
    });

    // 11. WS broadcast ke dashboard/leader
    try {
      broadcastToAll({ event: 'ORDER_RESERVED', transactionId, boothId: helperTenantId });
    } catch (e) { logger.warn('WS ORDER_RESERVED broadcast failed', { error: e.message }); }

    // Build item summary string untuk WA/WS
    const itemSummary = items
      .map(i => `${productMap[i.product_id].product_name} ×${i.qty}`)
      .join(', ');

    return {
      transactionId, status: 'RESERVED',
      subtotal, taxRate: TAX_RATE, taxAmount, totalAmount,
      expiresAt, qrPayload,
      publicToken, publicTokenExp,
      effectivePhone, customerId,
      itemSummary,
      boothId: helperTenantId,
      items: items.map(i => ({
        product_id:   i.product_id,
        product_name: productMap[i.product_id].product_name,
        qty:          i.qty,
        unit_price:   productMap[i.product_id].price,
      })),
    };
  });

  // ── Post-transaction: CR-036 Layer 1 (WA) + Layer 2 (WS) ────────────────
  // Fetch booth name untuk pesan WA
  let boothName = helperTenantId;
  try {
    const boothRow = await query('SELECT tenant_name FROM tenants WHERE tenant_id = $1', [helperTenantId]);
    if (boothRow.rows[0]?.tenant_name) boothName = boothRow.rows[0].tenant_name;
  } catch { /* pakai tenantId sebagai fallback */ }

  const publicLink = `${waConfig.baseUrl}/pesanan/${txResult.transactionId}?token=${txResult.publicToken}`;

  // Layer 1 — WA (async fire-and-forget; tidak block response)
  if (txResult.effectivePhone) {
    waSvc.sendOrderQR({
      phone:          txResult.effectivePhone,
      boothName,
      itemSummary:    txResult.itemSummary,
      totalAmount:    txResult.totalAmount,
      orderLink:      publicLink,
      expiryMinutes:  tokenTtlMinutes,
    }).then(async (waResult) => {
      try {
        await query(
          `UPDATE transactions
             SET wa_sent_at = $1, wa_delivery_status = $2
           WHERE transaction_id = $3`,
          [
            waResult.status === 'SENT' ? new Date() : null,
            waResult.status,
            txResult.transactionId,
          ],
        );
      } catch (e) {
        logger.warn('[CR-036] Gagal update wa_delivery_status', { error: e.message });
      }
    }).catch(err => logger.warn('[CR-036] WA sendOrderQR error', { error: err.message }));
  } else {
    // Tidak ada nomor — set SKIPPED langsung
    query(
      `UPDATE transactions SET wa_delivery_status = 'SKIPPED' WHERE transaction_id = $1`,
      [txResult.transactionId],
    ).catch(() => {});
  }

  // Layer 2 — WS push ke customer terdaftar (jika online)
  if (txResult.customerId) {
    try {
      broadcastToCustomer(txResult.customerId, {
        event: 'ORDER_RESERVED_FOR_CUSTOMER',
        payload: {
          txnId:       txResult.transactionId,
          boothName,
          itemSummary: txResult.itemSummary,
          totalAmount: txResult.totalAmount,
          qrLink:      publicLink,
        },
      });
    } catch (e) {
      logger.warn('[CR-036] WS Layer 2 push gagal', { error: e.message });
    }
  }

  // Layer 3 — QR selalu ada di return value (Helper layar)
  return {
    transactionId:    txResult.transactionId,
    status:           'RESERVED',
    subtotal:         txResult.subtotal,
    taxRate:          txResult.taxRate,
    taxAmount:        txResult.taxAmount,
    totalAmount:      txResult.totalAmount,
    expiresAt:        txResult.expiresAt,
    qrPayload:        txResult.qrPayload,
    publicLink,
    waSentTo:         txResult.effectivePhone
                        ? txResult.effectivePhone.slice(0, 4) + '****'
                        : null,
    waDeliveryStatus: txResult.effectivePhone ? 'PENDING' : 'SKIPPED',
    boothId:          helperTenantId,
    items:            txResult.items,
  };
}

/**
 * Kirim ulang WA untuk pesanan yang sudah ada.
 * Hanya jika token belum expire & status masih RESERVED / WAITING_PAYMENT.
 */
async function resendWa(transactionId, helperId, newPhone = null) {
  // Load transaksi + booth name
  const txRes = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.customer_phone,
            t.public_token, t.public_token_exp, t.customer_id,
            ten.tenant_name, ten.tenant_id
     FROM transactions t
     JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     JOIN tenants ten ON ten.tenant_id = ti.tenant_id
     WHERE t.transaction_id = $1
     LIMIT 1`,
    [transactionId],
  );
  const txn = txRes.rows[0];
  if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

  if (!['RESERVED', 'WAITING_PAYMENT'].includes(txn.status)) {
    throw new AppError('WA hanya bisa dikirim ulang untuk pesanan RESERVED atau WAITING_PAYMENT.', 422);
  }
  if (txn.public_token_exp && new Date(txn.public_token_exp) < new Date()) {
    throw new AppError('Token publik sudah kedaluwarsa. Order perlu dibuat ulang.', 422);
  }

  // Tentukan nomor tujuan: newPhone override > customer registered phone > stored customer_phone
  let targetPhone = newPhone || txn.customer_phone || null;
  if (!targetPhone && txn.customer_id) {
    try {
      const custRow = await query('SELECT phone_number FROM customers WHERE customer_id = $1', [txn.customer_id]);
      targetPhone = custRow.rows[0]?.phone_number || null;
    } catch { /* no phone */ }
  }
  if (!targetPhone) throw new AppError('Tidak ada nomor HP untuk pengiriman ulang WA.', 422);

  // Simpan newPhone ke transaksi jika berbeda
  if (newPhone && newPhone !== txn.customer_phone) {
    await query(
      'UPDATE transactions SET customer_phone = $1 WHERE transaction_id = $2',
      [newPhone, transactionId],
    );
  }

  const waConfig    = await waSvc.getWaConfig();
  const publicLink  = `${waConfig.baseUrl}/pesanan/${transactionId}?token=${txn.public_token}`;

  // Ambil item summary
  const itemRes = await query(
    `SELECT p.product_name, ti.quantity
     FROM transaction_items ti JOIN products p ON p.product_id = ti.product_id
     WHERE ti.transaction_id = $1`,
    [transactionId],
  );
  const itemSummary = itemRes.rows.map(r => `${r.product_name} ×${r.quantity}`).join(', ');

  const waResult = await waSvc.sendOrderQR({
    phone:         targetPhone,
    boothName:     txn.tenant_name,
    itemSummary,
    totalAmount:   txn.total_amount,
    orderLink:     publicLink,
    expiryMinutes: waConfig.ttlMinutes,
  });

  await query(
    `UPDATE transactions
       SET wa_sent_at = $1, wa_delivery_status = $2, customer_phone = COALESCE($3, customer_phone)
     WHERE transaction_id = $4`,
    [
      waResult.status === 'SENT' ? new Date() : null,
      waResult.status,
      newPhone || null,
      transactionId,
    ],
  );

  return {
    transactionId,
    waSentTo:         targetPhone.slice(0, 4) + '****',
    waDeliveryStatus: waResult.status,
    error:            waResult.error || null,
  };
}

/**
 * Cancel a RESERVED order. Returns stock to available pool.
 */
async function cancelHelperOrder(transactionId, helperId, helperTenantId) {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT t.*, ti_agg.items
       FROM transactions t
       CROSS JOIN LATERAL (
         SELECT json_agg(json_build_object('product_id', ti.product_id, 'quantity', ti.quantity)) AS items
         FROM transaction_items ti WHERE ti.transaction_id = t.transaction_id
       ) ti_agg
       WHERE t.transaction_id = $1
       FOR UPDATE`,
      [transactionId],
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

    validateTransition(txn, 'CANCELLED', 'HELPER');

    // Restore stock only if it was already deducted (RESERVED, not PENDING_APPROVAL)
    if (txn.status !== 'PENDING_APPROVAL' && txn.items) {
      for (const item of txn.items) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
          [item.quantity, item.product_id],
        );
      }
    }

    await client.query(
      `UPDATE transactions
       SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = 'Dibatalkan oleh helper'
       WHERE transaction_id = $1`,
      [transactionId],
    );

    await writeAuditLog({
      action: 'TXN_CANCELLED_HELPER', actorId: helperId, actorRole: 'HELPER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: txn.status },
      newValue: { status: 'CANCELLED' },
    });

    return { transactionId, status: 'CANCELLED' };
  });
}

/**
 * Mark order as HANDED_OVER then COMPLETED.
 */
async function handoverOrder(transactionId, helperId, helperTenantId) {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId],
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

    validateTransition(txn, 'HANDED_OVER', 'HELPER');

    await client.query(
      `UPDATE transactions
       SET status = 'HANDED_OVER', handover_at = NOW(), handover_by = $1
       WHERE transaction_id = $2`,
      [helperId, transactionId],
    );

    await client.query(
      `UPDATE transactions SET status = 'COMPLETED' WHERE transaction_id = $1`,
      [transactionId],
    );

    await client.query(
      `UPDATE transaction_items
       SET pickup_status = 'DONE', handed_over_at = NOW(), handed_over_by = $1
       WHERE transaction_id = $2 AND pickup_status = 'READY'`,
      [helperId, transactionId],
    );

    await writeAuditLog({
      action: 'TXN_HANDED_OVER', actorId: helperId, actorRole: 'HELPER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: 'PAID' },
      newValue: { status: 'COMPLETED' },
    });

    try {
      broadcastToAll({ event: 'ORDER_HANDED_OVER', transactionId, boothId: helperTenantId });
    } catch (e) { logger.warn('WS ORDER_HANDED_OVER broadcast failed', { error: e.message }); }

    return { transactionId, status: 'COMPLETED' };
  });
}

/**
 * List orders for this helper's booth.
 */
async function getBoothOrders(helperTenantId, { status, date } = {}) {
  const conditions = ['ti.tenant_id = $1'];
  const params = [helperTenantId];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') = $${params.length}`);
  }

  const result = await query(
    `SELECT DISTINCT ON (t.transaction_id)
            t.transaction_id, t.status, t.total_amount, t.created_at,
            t.customer_phone, t.reserved_at, t.handover_at,
            c.full_name AS customer_name, c.phone_number AS customer_reg_phone
     FROM transactions t
     JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.transaction_id, t.created_at DESC`,
    params,
  );

  return result.rows;
}

/**
 * Get a single transaction with items — scoped to this helper's booth.
 */
async function getBoothOrder(transactionId, helperTenantId) {
  const txResult = await query(
    `SELECT t.transaction_id, t.status, t.subtotal_amount, t.tax_rate, t.tax_amount,
            t.total_amount, t.qr_payload, t.created_at, t.reserved_at,
            t.customer_phone, t.handover_at, t.public_token, t.public_token_exp,
            t.wa_sent_at, t.wa_delivery_status,
            c.full_name AS customer_name, c.phone_number AS customer_reg_phone
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     WHERE t.transaction_id = $1`,
    [transactionId],
  );
  const txn = txResult.rows[0];
  if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

  const itemsResult = await query(
    `SELECT ti.product_id, p.product_name, ti.quantity, ti.unit_price, ti.subtotal,
            ti.pickup_status, ti.tenant_id
     FROM transaction_items ti
     JOIN products p ON p.product_id = ti.product_id
     WHERE ti.transaction_id = $1 AND ti.tenant_id = $2`,
    [transactionId, helperTenantId],
  );

  if (itemsResult.rows.length === 0) {
    throw new AppError('Transaksi tidak ditemukan di booth ini.', 404);
  }

  return { ...txn, items: itemsResult.rows };
}

/**
 * Get all products for this helper's booth.
 */
async function getBoothProducts(helperTenantId) {
  const result = await query(
    `SELECT product_id, product_name, category, price, barcode,
            stock_quantity, stock_status, image_url, description,
            is_display_only, is_on_hold, max_per_customer, bundle_group
     FROM products
     WHERE tenant_id = $1 AND is_active = TRUE
     ORDER BY category, product_name`,
    [helperTenantId],
  );
  return result.rows;
}

// ── CR-040: HELPER_APPROVE functions ─────────────────────────────────────────

const _SYSTEM_CONFIG_PATH_HELPER = path.join(__dirname, '../../../data/system-config.json');

function _getCheckoutTimeoutMinutesCR040() {
  try {
    const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH_HELPER, 'utf8'));
    const val = parseInt(cfg.txn_timeout_checkout, 10);
    return (Number.isFinite(val) && val > 0) ? val : 30;
  } catch {
    return 30;
  }
}

/**
 * Return all PENDING_APPROVAL orders for this helper's booth.
 * Sorted oldest-first so helper sees most urgent first.
 */
async function getApprovalQueue(helperTenantId) {
  const result = await query(
    `SELECT t.transaction_id, t.status, t.voucher_code,
            t.created_at, t.expires_at,
            SUM(ti.subtotal) AS total_amount,
            c.full_name AS customer_name, c.phone_number AS customer_phone
     FROM transactions t
     JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     WHERE ti.tenant_id = $1
       AND t.status = 'PENDING_APPROVAL'
       AND ti.approval_status = 'PENDING'
     GROUP BY t.transaction_id, t.status, t.voucher_code,
              t.created_at, t.expires_at,
              c.full_name, c.phone_number
     ORDER BY t.created_at ASC`,
    [helperTenantId],
  );

  // Fetch items for each transaction
  const txns = result.rows;
  for (const txn of txns) {
    const itemsRes = await query(
      `SELECT ti.product_id, p.product_name, ti.quantity, ti.unit_price,
              ti.subtotal, ti.approval_status
       FROM transaction_items ti
       JOIN products p ON p.product_id = ti.product_id
       WHERE ti.transaction_id = $1 AND ti.tenant_id = $2`,
      [txn.transaction_id, helperTenantId],
    );
    txn.items = itemsRes.rows;
  }

  return txns;
}

/**
 * Helper approves a PENDING_APPROVAL order.
 * Deducts stock, sets timer, transitions to PENDING.
 *
 * @param {string} transactionId
 * @param {string} helperId
 * @param {string} helperTenantId
 * @param {string} [note]           optional approval note
 */
async function approveOrder(transactionId, helperId, helperTenantId, note = null) {
  // ── Phase 1: atomic stock deduction + status transition (no QR inside) ────────
  // QR is excluded from the transaction so a QR failure never rolls back the approval.
  const committed = await withTransaction(async (client) => {
    // Lock the transaction row — OF t avoids the PG "nullable side of outer join" error
    const txResult = await client.query(
      `SELECT t.*, c.full_name AS customer_name, c.phone_number AS customer_phone_reg
       FROM transactions t
       LEFT JOIN customers c ON c.customer_id = t.customer_id
       WHERE t.transaction_id = $1
       FOR UPDATE OF t`,
      [transactionId],
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    if (txn.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Hanya transaksi PENDING_APPROVAL yang bisa disetujui. Status saat ini: ${txn.status}.`, 409);
    }

    // Fetch items for this booth
    const itemsRes = await client.query(
      `SELECT ti.product_id, ti.quantity
       FROM transaction_items ti
       WHERE ti.transaction_id = $1 AND ti.tenant_id = $2
       FOR UPDATE`,
      [transactionId, helperTenantId],
    );
    if (itemsRes.rows.length === 0) {
      throw new AppError('Tidak ada item dari booth ini dalam transaksi ini.', 404);
    }

    // Lock & validate stock before deducting
    for (const item of itemsRes.rows) {
      const prodRes = await client.query(
        `SELECT stock_quantity, stock_status, product_name
         FROM products WHERE product_id = $1 FOR UPDATE`,
        [item.product_id],
      );
      const prod = prodRes.rows[0];
      if (!prod || prod.stock_status === 'OUT_OF_STOCK' || prod.stock_quantity < item.quantity) {
        throw new AppError(
          `Stok produk "${prod?.product_name || item.product_id}" tidak mencukupi untuk disetujui.`,
          409,
        );
      }
    }

    // Deduct stock
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2`,
        [item.quantity, item.product_id],
      );
    }

    // Mark items as approved
    await client.query(
      `UPDATE transaction_items SET approval_status = 'APPROVED'
       WHERE transaction_id = $1 AND tenant_id = $2`,
      [transactionId, helperTenantId],
    );

    // Check if ALL items across ALL booths are now approved
    const pendingCheck = await client.query(
      `SELECT COUNT(*) AS cnt FROM transaction_items
       WHERE transaction_id = $1 AND approval_status != 'APPROVED'`,
      [transactionId],
    );
    const allApproved = parseInt(pendingCheck.rows[0].cnt) === 0;

    if (!allApproved) {
      await writeAuditLog({
        action: 'TXN_PARTIAL_APPROVED', actorId: helperId, actorRole: 'HELPER',
        entityType: 'TRANSACTION', entityId: transactionId,
        newValue: { partialApproval: true, approvedTenant: helperTenantId },
      });
      return { customerId: txn.customer_id, partialApproval: true };
    }

    // All booths approved — set payment timer and transition to PENDING
    const expiresAt = new Date(Date.now() + _getCheckoutTimeoutMinutesCR040() * 60 * 1000);

    // Transition PENDING_APPROVAL → PENDING (qr_payload left NULL here, set below)
    await client.query(
      `UPDATE transactions
         SET status             = 'PENDING',
             approved_at        = NOW(),
             approved_by        = $1,
             approval_note      = $2,
             timer_locked_until = $3,
             expires_at         = $3
       WHERE transaction_id     = $4`,
      [helperId, note, expiresAt, transactionId],
    );

    await writeAuditLog({
      action: 'TXN_APPROVED', actorId: helperId, actorRole: 'HELPER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: 'PENDING_APPROVAL' },
      newValue: { status: 'PENDING', approvedBy: helperId, expiresAt },
    });

    return { customerId: txn.customer_id, expiresAt };
  });
  // ── COMMIT happened above ─────────────────────────────────────────────────────

  // Partial approval — other booths still pending; notify without QR or status change
  if (committed.partialApproval) {
    try {
      broadcastToCustomer(committed.customerId, {
        event:         'ORDER_PARTIAL_APPROVED',
        transactionId,
        message:       'Sebagian booth telah menyetujui pesanan Anda.',
      });
    } catch (e) { logger.warn('WS ORDER_PARTIAL_APPROVED broadcast failed', { error: e.message }); }

    try {
      broadcastToTenant(helperTenantId, {
        event:         'APPROVAL_QUEUE_UPDATE',
        transactionId,
        action:        'PARTIAL_APPROVED',
      });
    } catch (e) { logger.warn('WS APPROVAL_QUEUE_UPDATE broadcast failed', { error: e.message }); }

    return { transactionId, status: 'PENDING_APPROVAL', partialApproval: true };
  }

  // ── Phase 2: QR generation (non-critical — failure must NOT undo the approval) ─
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
    logger.error('[approveOrder] QR generation failed — approval still committed', {
      transactionId, error: qrErr.message,
    });
  }

  // ── Phase 3: WS broadcasts (after commit so listeners see consistent DB state) ─
  try {
    broadcastToCustomer(committed.customerId, {
      event:         'ORDER_APPROVED',
      transactionId,
      expiresAt:     committed.expiresAt,
      qrPayload,
      message:       'Pesanan Anda telah disetujui. Silakan lakukan pembayaran.',
    });
  } catch (e) { logger.warn('WS ORDER_APPROVED broadcast failed', { error: e.message }); }

  try {
    broadcastToTenant(helperTenantId, {
      event:         'APPROVAL_QUEUE_UPDATE',
      transactionId,
      action:        'APPROVED',
    });
  } catch (e) { logger.warn('WS APPROVAL_QUEUE_UPDATE broadcast failed', { error: e.message }); }

  return {
    transactionId,
    status:    'PENDING',
    expiresAt: committed.expiresAt,
    qrPayload,
  };
}

/**
 * Helper rejects a PENDING_APPROVAL order.
 * No stock was reserved — simply cancel the transaction.
 *
 * @param {string} transactionId
 * @param {string} helperId
 * @param {string} helperTenantId
 * @param {string} [reason]
 */
async function rejectOrder(transactionId, helperId, helperTenantId, reason = 'Ditolak oleh helper') {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId],
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    if (txn.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Hanya transaksi PENDING_APPROVAL yang bisa ditolak. Status saat ini: ${txn.status}.`, 409);
    }

    // Verify it belongs to this booth
    const checkRes = await client.query(
      `SELECT 1 FROM transaction_items WHERE transaction_id = $1 AND tenant_id = $2 LIMIT 1`,
      [transactionId, helperTenantId],
    );
    if (checkRes.rowCount === 0) {
      throw new AppError('Transaksi tidak ditemukan di booth ini.', 404);
    }

    // Mark items as rejected
    await client.query(
      `UPDATE transaction_items SET approval_status = 'REJECTED'
       WHERE transaction_id = $1 AND tenant_id = $2`,
      [transactionId, helperTenantId],
    );

    // Cancel the order — no stock to restore (was never deducted)
    await client.query(
      `UPDATE transactions
         SET status = 'CANCELLED', cancelled_at = NOW(),
             approval_note = $1, cancellation_reason = $2
       WHERE transaction_id = $3`,
      [reason, reason, transactionId],
    );

    await writeAuditLog({
      action: 'TXN_REJECTED', actorId: helperId, actorRole: 'HELPER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: 'PENDING_APPROVAL' },
      newValue: { status: 'CANCELLED', reason },
    });

    // Notify customer via WS
    try {
      broadcastToCustomer(txn.customer_id, {
        event:         'ORDER_REJECTED',
        transactionId,
        reason,
        message:       `Pesanan Anda ditolak. Alasan: ${reason}`,
      });
    } catch (e) { logger.warn('WS ORDER_REJECTED broadcast failed', { error: e.message }); }

    // Update helper channel queue
    try {
      broadcastToTenant(helperTenantId, {
        event:         'APPROVAL_QUEUE_UPDATE',
        transactionId,
        action:        'REJECTED',
      });
    } catch (e) { logger.warn('WS APPROVAL_QUEUE_UPDATE broadcast failed', { error: e.message }); }

    return { transactionId, status: 'CANCELLED', reason };
  });
}

module.exports = {
  createHelperOrder,
  resendWa,
  cancelHelperOrder,
  handoverOrder,
  getBoothOrders,
  getBoothOrder,
  getBoothProducts,
  // CR-040
  getApprovalQueue,
  approveOrder,
  rejectOrder,
};
