'use strict';

const { Router } = require('express');
const { verifyWebhookSignature } = require('../middleware/webhook.auth');
const orderPush     = require('../services/order.push');
const voucherSvc    = require('../services/payment-voucher.service');
const cancelSync    = require('../services/cancel.sync');
const customerSvc   = require('../services/customer.sync');
const logger = require('../config/logger');

const router = Router();

// All webhook routes require signature verification
router.use(verifyWebhookSignature);

/**
 * POST /webhook/order-paid
 * Payload: { transactionId, status, totalAmount, paidAt, customerId }
 */
router.post('/order-paid', async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

  // Respond immediately; process async (fire-and-forget)
  res.json({ received: true });

  logger.info('Webhook: ORDER_PAID received', { transactionId });

  // Push SO first; only trigger voucher chain if SO push succeeded.
  // If push fails (CB open, Odoo down, etc.) both jobs are picked up
  // by the retry queue / polling on their next cycle.
  orderPush.pushOrder(transactionId)
    .then(result => {
      if (result?.success) {
        return voucherSvc.pushPaymentVoucher(transactionId);
      }
    })
    .catch(err =>
      logger.error('Webhook ORDER_PAID handler error', { transactionId, error: err.message })
    );
});

/**
 * POST /webhook/order-cancelled
 * Payload: { transactionId, status, cancelledAt, customerId }
 */
router.post('/order-cancelled', async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

  res.json({ received: true });

  logger.info('Webhook: ORDER_CANCELLED received', { transactionId });
  cancelSync.cancelOrder(transactionId).catch(err =>
    logger.error('Webhook ORDER_CANCELLED handler error', { transactionId, error: err.message })
  );
});

/**
 * POST /webhook/customer-registered
 * Payload: { customer_id, full_name, phone_number, email, gender }
 */
router.post('/customer-registered', async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

  res.json({ received: true });

  logger.info('Webhook: CUSTOMER_REGISTERED received', { customer_id });
  customerSvc.resolveOrCreatePartner(req.body).catch(err =>
    logger.error('Webhook CUSTOMER_REGISTERED handler error', { customer_id, error: err.message })
  );
});

module.exports = router;
