'use strict';

const express  = require('express');
const { body } = require('express-validator');
const { validate }    = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { query }       = require('../../config/database');
const { AppError }    = require('../../middlewares/error.middleware');

const router = express.Router();

// Semua route butuh JWT customer
router.use(authenticate);

/**
 * GET /api/v1/customer/me
 * Profil customer yang sedang login
 */
router.get('/me', async (req, res, next) => {
  try {
    if (req.user.role !== 'CUSTOMER') throw new AppError('Forbidden.', 403);

    const result = await query(
      `SELECT customer_id, full_name, phone_number, email, gender, birth_date, registered_at
       FROM customers WHERE customer_id = $1 AND is_active = TRUE`,
      [req.user.customerId]
    );
    const customer = result.rows[0];
    if (!customer) throw new AppError('Akun tidak ditemukan.', 404);

    // Sensor data sensitif
    const phone = customer.phone_number;
    const maskedPhone = phone.slice(0, 4) + '****' + phone.slice(-3);

    let maskedEmail = null;
    if (customer.email) {
      const [local, domain] = customer.email.split('@');
      const visible = local.length > 2 ? local.slice(0, 2) : local[0] || '*';
      maskedEmail = `${visible}***@${domain}`;
    }

    res.json({
      success: true,
      data: {
        customer_id:   customer.customer_id,
        full_name:     customer.full_name,
        phone_number:  maskedPhone,
        email:         maskedEmail,
        gender:        customer.gender,
        birth_date:    customer.birth_date,
        registered_at: customer.registered_at,
      },
    });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/v1/customer/me/email
 * Update email customer
 */
router.patch('/me/email',
  [
    body('email').isEmail().withMessage('Format email tidak valid.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'CUSTOMER') throw new AppError('Forbidden.', 403);

      await query(
        `UPDATE customers SET email = $1 WHERE customer_id = $2`,
        [req.body.email.trim(), req.user.customerId]
      );

      res.json({ success: true, message: 'Email berhasil diperbarui.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
