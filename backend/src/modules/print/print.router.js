'use strict';

const express = require('express');
const { body } = require('express-validator');
const { validate }    = require('../../middlewares/validate.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { printReceipt, resolvePrinter } = require('./print.service');
const { AppError }    = require('../../middlewares/error.middleware');

const router = express.Router();

/**
 * POST /api/v1/print/receipt
 * Sends an ESC/POS receipt directly to the thermal printer via TCP.
 * Requires printer configured via PRINTER_IP env var.
 */
router.post('/receipt',
  authenticate,
  authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('txn').isObject().withMessage('txn wajib diisi.'),
    body('txn.transaction_id').notEmpty().withMessage('transaction_id wajib diisi.'),
    body('cashierName').notEmpty().withMessage('cashierName wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { txn, success, cashierName, customer, cashReceived } = req.body;
      await printReceipt({ txn, success, cashierName, customer, cashReceived, userId: req.user.userId });
      res.json({ success: true, message: 'Struk berhasil dicetak.' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/print/status
 * Check whether a printer is configured and reachable.
 */
router.get('/status',
  authenticate,
  authorize('CASHIER', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      // ?userId= → check that cashier's assigned printer; omit → check global printer
      const userId = req.query.userId || null;
      const addr   = await resolvePrinter(userId);

      if (!addr) {
        return res.json({ success: true, configured: false, message: 'IP Printer belum dikonfigurasi.' });
      }

      const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
      const printer = new ThermalPrinter({
        type:      PrinterTypes.EPSON,
        interface: `tcp://${addr.ip}:${addr.port}`,
        options:   { timeout: 3000 },
      });
      const connected = await printer.isPrinterConnected();
      res.json({
        success:    true,
        configured: true,
        connected,
        address:    `${addr.ip}:${addr.port}`,
        message:    connected ? 'Printer terhubung.' : 'Printer tidak dapat dijangkau.',
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
