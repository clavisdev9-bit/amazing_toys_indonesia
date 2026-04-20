'use strict';

const { Router } = require('express');
const cb = require('../utils/circuit.breaker');
const retryQueue = require('../queue/retry.queue');
const { query } = require('../config/database');
const logger = require('../config/logger');

const router = Router();
const _startedAt = new Date().toISOString();

// Track last successful sync times
const syncTimes = { product: null, stock: null, sweep: null };

function updateSyncTime(type) {
  syncTimes[type] = new Date().toISOString();
}

router.get('/', async (req, res) => {
  let dbOk = false;
  try {
    await query('SELECT 1');
    dbOk = true;
  } catch (_) {}

  const status = {
    service: 'sos-odoo-integration',
    version: '1.0.0',
    startedAt: _startedAt,
    uptime: process.uptime(),
    db: dbOk ? 'OK' : 'ERROR',
    circuitBreakers: cb.getStatus(),
    retryQueueDepth: retryQueue.size(),
    lastSyncTimes: syncTimes,
  };

  const httpStatus = dbOk ? 200 : 503;
  res.status(httpStatus).json(status);
});

module.exports = { router, updateSyncTime };
