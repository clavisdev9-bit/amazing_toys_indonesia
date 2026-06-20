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

/**
 * Ambil semua active product promo rules untuk product_ids tertentu.
 * Dipanggil oleh frontend (cart preview) dan backend (checkout).
 *
 * @param {string[]} productIds  - array product_id yang ada di cart
 * @returns {Array} rules dengan info produk gratis
 */
async function getActiveProductPromos(productIds = []) {
  if (!productIds.length) return [];

  const res = await query(
    `SELECT
       r.id,
       r.voucher_id,
       v.code              AS voucher_code,
       v.tenant_id         AS voucher_tenant_id,
       r.buy_product_id,
       bp.product_name     AS buy_product_name,
       COALESCE(r.free_product_id, r.buy_product_id) AS free_product_id,
       fp.product_name     AS free_product_name,
       fp.price            AS free_product_price,
       fp.stock_quantity   AS free_product_stock,
       r.buy_qty,
       r.free_qty,
       r.max_free_qty,
       r.priority
     FROM voucher_product_rule r
     JOIN vouchers v
       ON v.id = r.voucher_id
      AND v.is_active = TRUE
      AND NOW() BETWEEN v.valid_from AND v.valid_until
     JOIN products bp ON bp.product_id = r.buy_product_id AND bp.is_active = TRUE
     JOIN products fp ON fp.product_id = COALESCE(r.free_product_id, r.buy_product_id)
                      AND fp.is_active = TRUE
     WHERE r.buy_product_id = ANY($1)
     ORDER BY r.priority ASC`,
    [productIds]
  );
  return res.rows;
}

/**
 * Hitung free items dari promo rules berdasarkan isi cart.
 * Pure calculation — tidak menyentuh database.
 *
 * @param {Array} cartItems   [{ product_id, quantity }]
 * @param {Array} rules       hasil getActiveProductPromos()
 * @returns {Array}           [{ free_product_id, free_product_name, free_qty, voucher_code, stock_available }]
 */
function calculateFreeItems(cartItems, rules) {
  const freeItems = [];
  for (const rule of rules) {
    const cartItem = cartItems.find(i => i.product_id === rule.buy_product_id);
    if (!cartItem) continue;

    const rawFree = Math.floor(cartItem.quantity / rule.buy_qty) * rule.free_qty;
    if (rawFree <= 0) continue;

    const maxCapped = (rule.max_free_qty != null)
      ? Math.min(rawFree, rule.max_free_qty)
      : rawFree;

    const stockAvailable = rule.free_product_stock != null
      ? parseInt(rule.free_product_stock, 10)
      : Infinity;
    const finalQty = Math.min(maxCapped, stockAvailable);

    if (finalQty <= 0) continue;

    freeItems.push({
      free_product_id:   rule.free_product_id,
      free_product_name: rule.free_product_name,
      free_product_price: parseFloat(rule.free_product_price || 0),
      free_qty:          finalQty,
      raw_free_qty:      rawFree,
      max_free_qty:      rule.max_free_qty,
      stock_available:   stockAvailable,
      voucher_code:      rule.voucher_code,
      buy_product_id:    rule.buy_product_id,
      buy_product_name:  rule.buy_product_name,
      voucher_tenant_id: rule.voucher_tenant_id,
      is_same_product:   rule.free_product_id === null,
      capped_by_max:     rule.max_free_qty != null && rawFree > rule.max_free_qty,
      capped_by_stock:   stockAvailable < maxCapped,
    });
  }
  return freeItems;
}

/**
 * Buat/update voucher bertipe PRODUCT_PROMO beserta rules-nya (atomic).
 */
async function createProductPromoVoucher(data) {
  const {
    code, description, valid_from, valid_until, tenant_id, usage_limit,
    created_by, rules = [],
  } = data;

  if (!rules.length) throw new AppError('Minimal 1 rule produk wajib diisi.', 400);

  return withTransaction(async (client) => {
    const vRes = await client.query(
      `INSERT INTO vouchers
         (code, description, discount_type, discount_value, valid_from, valid_until,
          tenant_id, usage_limit, created_by)
       VALUES ($1, $2, 'PRODUCT_PROMO', 0, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code.trim().toUpperCase(), description || null, valid_from, valid_until,
       tenant_id || null, usage_limit || null, created_by || null]
    );
    const voucher = vRes.rows[0];

    for (const rule of rules) {
      await client.query(
        `INSERT INTO voucher_product_rule
           (voucher_id, buy_product_id, free_product_id, buy_qty, free_qty, max_free_qty, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [voucher.id, rule.buy_product_id, rule.free_product_id || null,
         rule.buy_qty || 1, rule.free_qty || 1, rule.max_free_qty || null, rule.priority || 1]
      );
    }

    const rulesRes = await client.query(
      `SELECT * FROM voucher_product_rule WHERE voucher_id = $1 ORDER BY priority`,
      [voucher.id]
    );
    return { ...voucher, rules: rulesRes.rows };
  });
}

async function listProductPromoVouchers({ activeOnly = false } = {}) {
  const where = activeOnly
    ? `WHERE v.is_active = TRUE AND NOW() BETWEEN v.valid_from AND v.valid_until`
    : `WHERE v.discount_type = 'PRODUCT_PROMO'`;
  const res = await query(
    `SELECT v.*,
       json_agg(
         json_build_object(
           'id', r.id,
           'buy_product_id', r.buy_product_id,
           'free_product_id', r.free_product_id,
           'buy_qty', r.buy_qty,
           'free_qty', r.free_qty,
           'max_free_qty', r.max_free_qty,
           'priority', r.priority
         ) ORDER BY r.priority
       ) FILTER (WHERE r.id IS NOT NULL) AS rules
     FROM vouchers v
     LEFT JOIN voucher_product_rule r ON r.voucher_id = v.id
     ${where}
       AND v.discount_type = 'PRODUCT_PROMO'
     GROUP BY v.id
     ORDER BY v.created_at DESC`
  );
  return res.rows;
}

module.exports = {
  validateVoucher, applyVoucher, getVoucherByCode, listVouchers, createVoucher, updateVoucher, deactivateVoucher,
  getActiveProductPromos, calculateFreeItems, createProductPromoVoucher, listProductPromoVouchers,
};
