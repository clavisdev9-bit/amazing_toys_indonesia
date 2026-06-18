'use strict';

const nodemailer = require('nodemailer');
const { query }  = require('./database');

async function _loadDbConfig() {
  try {
    const keys = ['email_smtp_host', 'email_smtp_port', 'email_smtp_user', 'email_smtp_pass', 'email_from', 'email_notify_to'];
    const { rows } = await query('SELECT key, value FROM system_settings WHERE key = ANY($1)', [keys]);
    const map = {};
    rows.forEach((r) => { map[r.key] = r.value; });
    return map;
  } catch {
    return {};
  }
}

async function getConfig() {
  const db = await _loadDbConfig();
  return {
    host:     db.email_smtp_host || process.env.SMTP_HOST     || '',
    port:     parseInt(db.email_smtp_port || process.env.SMTP_PORT || '587', 10),
    user:     db.email_smtp_user || process.env.SMTP_USER     || '',
    pass:     db.email_smtp_pass || process.env.SMTP_PASS     || '',
    from:     db.email_from      || process.env.EMAIL_FROM    || '',
    notifyTo: db.email_notify_to || process.env.EMAIL_NOTIFY_TO || '',
  };
}

async function isReady() {
  const cfg = await getConfig();
  return !!(cfg.host && cfg.user && cfg.pass);
}

async function sendMail(opts) {
  const cfg = await getConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return null;
  const t = nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: false,
    auth:   { user: cfg.user, pass: cfg.pass },
  });
  return t.sendMail({
    ...opts,
    from: opts.from || cfg.from,
  });
}

module.exports = { sendMail, isReady, getConfig };
