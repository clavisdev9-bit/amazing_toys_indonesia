'use strict';

/**
 * Tenant-facing order management:
 *  - View paid orders for their booth
 *  - Validate handover (scan/input TXN ID)
 *  - Mark items as DONE
 */

const express  = require('express');
const { body } = require('express-validator');
const { authenticate, authorize, ownTenantOnly } = require('../../middlewares/auth.middleware');
const { validate }   = require('../../middlewares/validate.middleware');
const { query, withTransaction } = require('../../config/database');
const { writeAuditLog } = require('../../utils/auditLog');
const { AppError }   = require('../../middlewares/error.middleware');
const { broadcastToCustomer } = require('../../ws/websocket');

const router = express.Router();

/**
 * GET /api/v1/tenant-orders
 * Tenant views paid orders for their booth
 */
router.get('/',
  authenticate, authorize('TENANT', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const result = await query(
        `SELECT t.transaction_id, t.paid_at, t.total_amount,
                c.full_name AS customer_name, c.phone_number,
                ti.item_id, ti.product_id, p.product_name, ti.quantity, ti.unit_price,
                ti.pickup_status, ti.handed_over_at
         FROM transaction_items ti
         JOIN transactions t ON t.transaction_id = ti.transaction_id
         JOIN customers c ON c.customer_id = t.customer_id
         JOIN products p ON p.product_id = ti.product_id
         WHERE ti.tenant_id = $1 AND t.status = 'PAID'
         ORDER BY ti.pickup_status ASC, t.paid_at ASC`,
        [tenantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/tenant-orders/handover
 * Tenant validates pickup slip and marks items as DONE
 */
router.post('/handover',
  authenticate, authorize('TENANT', 'LEADER', 'ADMIN'),
  [
    body('transaction_id').trim().notEmpty().withMessage('Transaction ID wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const { transaction_id } = req.body;

      let customerId = null;

      await withTransaction(async (client) => {
        // Verify transaction is PAID and get customer_id
        const txResult = await client.query(
          `SELECT status, customer_id FROM transactions WHERE transaction_id = $1`,
          [transaction_id]
        );
        const txn = txResult.rows[0];
        if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
        if (txn.status !== 'PAID') throw new AppError('Transaksi belum dibayar.');
        customerId = txn.customer_id;

        // Mark this tenant's items as DONE
        const updated = await client.query(
          `UPDATE transaction_items
           SET pickup_status = 'DONE', handed_over_at = NOW(), handed_over_by = $1
           WHERE transaction_id = $2 AND tenant_id = $3 AND pickup_status = 'READY'
           RETURNING item_id`,
          [req.user.userId, transaction_id, tenantId]
        );

        if (updated.rows.length === 0) {
          throw new AppError('Tidak ada item yang perlu diserahkan (sudah DONE atau bukan milik tenant ini).');
        }

        await writeAuditLog({
          action: 'HANDOVER_COMPLETED', actorId: req.user.userId, actorRole: 'TENANT',
          entityType: 'TRANSACTION', entityId: transaction_id,
          newValue: { tenantId, itemsHandedOver: updated.rows.length },
        });
      });

      // Notify the customer's pickup status page in real-time
      if (customerId) {
        broadcastToCustomer(customerId, { event: 'PICKUP_DONE', transactionId: transaction_id, tenantId });
      }

      res.json({ success: true, message: 'Handover selesai. Status item diperbarui ke DONE.' });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/tenant-orders/dashboard
 * Tenant sales dashboard (own booth only)
 */
router.get('/dashboard',
  authenticate, authorize('TENANT', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const date = req.query.date || new Date().toISOString().slice(0, 10);

      const [summary, topProducts] = await Promise.all([
        query(
          `SELECT COUNT(DISTINCT ti.transaction_id) AS orders_today,
                  SUM(ti.subtotal) AS revenue_today,
                  COUNT(ti.item_id) FILTER (WHERE ti.pickup_status = 'DONE') AS items_done,
                  COUNT(ti.item_id) FILTER (WHERE ti.pickup_status = 'READY') AS items_pending
           FROM transaction_items ti
           JOIN transactions t ON t.transaction_id = ti.transaction_id
           WHERE ti.tenant_id = $1 AND t.status = 'PAID'
             AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $2`,
          [tenantId, date]
        ),
        query(
          `SELECT p.product_name, SUM(ti.quantity) AS qty_sold, SUM(ti.subtotal) AS revenue
           FROM transaction_items ti
           JOIN products p ON p.product_id = ti.product_id
           JOIN transactions t ON t.transaction_id = ti.transaction_id
           WHERE ti.tenant_id = $1 AND t.status = 'PAID'
             AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $2
           GROUP BY p.product_name
           ORDER BY revenue DESC
           LIMIT 5`,
          [tenantId, date]
        ),
      ]);

      res.json({
        success: true,
        data: {
          date,
          tenantId,
          summary: summary.rows[0],
          topProducts: topProducts.rows,
        },
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
