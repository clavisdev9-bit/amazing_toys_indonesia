'use strict';

const express = require('express');
const { authenticate, authorize, ownTenantOnly } = require('../../middlewares/auth.middleware');
const notifSvc = require('./notifications.service');

const router = express.Router();

// GET /api/v1/notifications — tenant's unread notifications
router.get('/',
  authenticate, authorize('TENANT', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const data = await notifSvc.getUnreadNotifications(tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/notifications/read — mark all as read
router.post('/read',
  authenticate, authorize('TENANT'),
  async (req, res, next) => {
    try {
      await notifSvc.markNotificationsRead(req.user.tenantId);
      res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
