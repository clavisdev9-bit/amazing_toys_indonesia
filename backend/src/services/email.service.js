'use strict';

const transporter = require('../config/mailer');

async function sendLoginAlert({ username, role, name, loginAt }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const roleLabel = { CASHIER: 'Kasir', TENANT: 'Tenant', LEADER: 'Leader', ADMIN: 'Admin' }[role] ?? role;
  const time = loginAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_NOTIFY_TO,
    subject: `[SOS] Login: ${name} (${roleLabel})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1f2937;padding:20px 24px">
          <h2 style="color:#fff;margin:0;font-size:18px">🔐 Amazing Toys SOS — Login Alert</h2>
        </div>
        <div style="padding:24px">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px">Nama</td><td style="padding:6px 0;font-weight:600">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Username</td><td style="padding:6px 0">${username}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Role</td><td style="padding:6px 0">${roleLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Waktu Login</td><td style="padding:6px 0">${time} WIB</td></tr>
          </table>
          <p style="font-size:12px;color:#9ca3af;margin-top:16px">Email ini dikirim otomatis oleh sistem SOS Amazing Toys Fair 2026.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendLoginAlert };
