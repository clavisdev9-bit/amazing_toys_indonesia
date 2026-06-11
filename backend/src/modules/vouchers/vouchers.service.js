'use strict';

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');


/**
 * Validate a voucher code against cart context.
 * Returns discount details if valid; throws AppError with error code if not.
 *
 * @param {object}   p
 * @param {string}   p.code
 * @param {string}   p.customerId
 * @param {number}   p.cartTotal    pre-tax total of ALL items in IDR
 * @param {string[]} p.tenantIds
 * @param {Array}    p.items        [{ price, quantity, tenant_id }] — required for
 *                                  tenant-scoped discount calculation
 */
async function validateVoucher({ code, customerId, cartTotal, tenantIds, items }) {
  // 1. Fetch voucher
  const vRes = await query(
    `SELECT * FROM vouchers WHERE code = $1 AND is_active = TRUE`,
    [code.trim().toUpperCase()]
  );
  if (!vRes.rows.length) throw new AppError('VOUCHER_NOT_FOUND', 400);
  const v = vRes.rows[0];

  // 2. Time window
  const now = new Date();
  if (now < new Date(v.valid_from) || now > new Date(v.valid_until)) {
    throw new AppError('VOUCHER_EXPIRED', 400);
  }

  // 3. Usage limit
  if (v.usage_limit !== null && v.usage_count >= v.usage_limit) {
    throw new AppError('VOUCHER_USAGE_LIMIT', 400);
  }

  // 4. Minimum purchase
  if (cartTotal < parseFloat(v.min_purchase)) {
    const err = new AppError('MIN_PURCHASE_NOT_MET', 400);
    err.minPurchase = parseFloat(v.min_purchase);
    throw err;
  }

  // 5. Tenant restriction
  if (v.tenant_id) {
    const validTenants = v.tenant_id.split(',').map(t => t.trim());
    const hasMatch = (tenantIds || []).some(tid => validTenants.includes(tid));
    if (!hasMatch) throw new AppError('VOUCHER_NOT_APPLICABLE', 400);
  }

  // 6. Calculate discount_amount (pre-tax, rounded to integer IDR)
  //    When the voucher is tenant-scoped, apply the discount ONLY to items
  //    from the restricted tenant — not to the full cart.
  let effectiveSubtotal = cartTotal; // default: full cart

  if (v.tenant_id && items && items.length > 0) {
    const restrictedTenants = v.tenant_id.split(',').map(t => t.trim());
    const tenantSubtotal = items
      .filter(i => restrictedTenants.includes(i.tenant_id))
      .reduce((sum, i) => sum + (parseFloat(i.price || 0) * parseInt(i.quantity, 10)), 0);
    effectiveSubtotal = tenantSubtotal;
  }

  let discountAmount;
  if (v.discount_type === 'PERCENT') {
    const raw = effectiveSubtotal * (parseFloat(v.discount_value) / 100);
    const cap = v.max_discount != null ? parseFloat(v.max_discount) : Infinity;
    discountAmount = Math.round(Math.min(raw, cap));
  } else {
    discountAmount = Math.round(Math.min(parseFloat(v.discount_value), effectiveSubtotal));
  }
  discountAmount = Math.max(0, discountAmount);

  return {
    valid: true,
    code: v.code,
    discount_amount: discountAmount,
    discount_type: v.discount_type,
    discount_value: parseFloat(v.discount_value),
    description: v.description || '',
    voucher_tenant_id: v.tenant_id || null,
  };
}

/**
 * Record voucher usage and increment counter.
 * Called inside an existing DB transaction from orders.service.js,
 * OR standalone (internal /vouchers/apply endpoint).
 *
 * @param {object} p
 * @param {string} p.code
 * @param {string} p.transactionId
 * @param {string|null} p.customerId
 * @param {number} p.discountAmount
 * @param {object|null} p.client  — if provided, reuse this pg client (same tx)
 */
async function applyVoucher({ code, transactionId, customerId, discountAmount, client: sharedClient }) {
  const run = async (c) => {
    // Idempotent insert — ON CONFLICT DO NOTHING if already applied to this transaction
    const insertRes = await c.query(
      `INSERT INTO voucher_usages (voucher_code, transaction_id, customer_id, discount_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (voucher_code, transaction_id) DO NOTHING`,
      [code, transactionId, customerId || null, discountAmount]
    );

    // Only increment usage_count when a new row was actually inserted.
    // If INSERT was a no-op (same voucher+transaction already recorded), skip the
    // increment to prevent double-counting on retries or concurrent calls.
    if (insertRes.rowCount > 0) {
      await c.query(
        `UPDATE vouchers
         SET usage_count = usage_count + 1
         WHERE code = $1
           AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [code]
      );
    }

    // Sync voucher_code / discount_amount onto transaction (fallback update)
    await c.query(
      `UPDATE transactions
       SET voucher_code = $1, discount_amount = $2
       WHERE transaction_id = $3`,
      [code, discountAmount, transactionId]
    );
  };

  if (sharedClient) {
    await run(sharedClient);
  } else {
    await withTransaction(run);
  }

  return { success: true };
}

async function getVoucherByCode(code) {
  const res = await query(`SELECT * FROM vouchers WHERE code = $1`, [code.trim().toUpperCase()]);
  if (!res.rows.length) throw new AppError('Voucher tidak ditemukan.', 404);
  return res.rows[0];
}

async function listVouchers({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = TRUE' : '';
  const res = await query(`SELECT * FROM vouchers ${where} ORDER BY created_at DESC`);
  return res.rows;
}

async function createVoucher(data) {
  const { code, description, discount_type, discount_value, min_purchase,
          max_discount, usage_limit, valid_from, valid_until, tenant_id, created_by } = data;
  const res = await query(
    `INSERT INTO vouchers
       (code, description, discount_type, discount_value, min_purchase, max_discount,
        usage_limit, valid_from, valid_until, tenant_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [code.trim().toUpperCase(), description, discount_type, discount_value,
     min_purchase ?? 0, max_discount ?? null, usage_limit ?? null,
     valid_from, valid_until, tenant_id ?? null, created_by ?? null]
  );
  return res.rows[0];
}

async function updateVoucher(code, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['description','discount_type','discount_value','min_purchase',
                   'max_discount','usage_limit','valid_from','valid_until',
                   'is_active','tenant_id'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (!fields.length) throw new AppError('Tidak ada field yang diubah.', 400);
  values.push(code.trim().toUpperCase());

  const res = await query(
    `UPDATE vouchers SET ${fields.join(', ')} WHERE code = $${idx} RETURNING *`,
    values
  );
  if (!res.rows.length) throw new AppError('Voucher tidak ditemukan.', 404);
  return res.rows[0];
}

async function deactivateVoucher(code) {
  const res = await query(
    `UPDATE vouchers SET is_active = FALSE WHERE code = $1 RETURNING *`,
    [code.trim().toUpperCase()]
  );
  if (!res.rows.length) throw new AppError('Voucher tidak ditemukan.', 404);
  return res.rows[0];
}

module.exports = { validateVoucher, applyVoucher, getVoucherByCode, listVouchers, createVoucher, updateVoucher, deactivateVoucher };
