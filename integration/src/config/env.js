'use strict';

require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  SOS_BASE_URL: process.env.SOS_BASE_URL || 'http://localhost:3000/api/v1',
  SOS_ADMIN_USERNAME: process.env.SOS_ADMIN_USERNAME,
  SOS_ADMIN_PASSWORD: process.env.SOS_ADMIN_PASSWORD,

  ODOO_BASE_URL: process.env.ODOO_BASE_URL || 'http://localhost:8069',
  ODOO_DB: process.env.ODOO_DB,
  ODOO_LOGIN: process.env.ODOO_LOGIN,
  ODOO_PASSWORD: process.env.ODOO_PASSWORD,
  ODOO_WALKIN_PARTNER_ID: parseInt(process.env.ODOO_WALKIN_PARTNER_ID || '0', 10),

  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  XREF_DB_URL: process.env.XREF_DB_URL,

  LOW_STOCK_THRESHOLD: parseInt(process.env.LOW_STOCK_THRESHOLD || '10', 10),
  PRODUCT_SYNC_INTERVAL_MIN: parseInt(process.env.PRODUCT_SYNC_INTERVAL_MIN || '30', 10),
  STOCK_SYNC_INTERVAL_MIN: parseInt(process.env.STOCK_SYNC_INTERVAL_MIN || '30', 10),
  SWEEP_INTERVAL_MIN: parseInt(process.env.SWEEP_INTERVAL_MIN || '5', 10),
  POLLING_INTERVAL_SEC: parseInt(process.env.POLLING_INTERVAL_SEC || '60', 10),
  RETRY_MAX_ATTEMPTS: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
  CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  CIRCUIT_BREAKER_RESET_MIN: parseInt(process.env.CIRCUIT_BREAKER_RESET_MIN || '2', 10),

  TENANT_PRODUCT_MAPPING: JSON.parse(process.env.TENANT_PRODUCT_MAPPING || '{}'),
  DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID || 'T001',
};
