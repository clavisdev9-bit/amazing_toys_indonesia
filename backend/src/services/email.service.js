'use strict';

const transporter    = require('../config/mailer');
const { getSystemConfig } = require('../modules/admin/admin.service');

async function _getEventName() {
  const cfg = await getSystemConfig();
  return cfg.event_name || 'SOS';
}

async function sendLoginAlert({ username, role, name, loginAt }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const roleLabel = { CASHIER: 'Kasir', TENANT: 'Tenant', LEADER: 'Leader', ADMIN: 'Admin' }[role] ?? role;
  const time = loginAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
  const eventName = await _getEventName();

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_NOTIFY_TO,
    subject: `[SOS] Login: ${name} (${roleLabel})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1f2937;padding:20px 24px">
          <h2 style="color:#fff;margin:0;font-size:18px">🔐 ${eventName} SOS — Login Alert</h2>
        </div>
        <div style="padding:24px">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px">Nama</td><td style="padding:6px 0;font-weight:600">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Username</td><td style="padding:6px 0">${username}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Role</td><td style="padding:6px 0">${roleLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Waktu Login</td><td style="padding:6px 0">${time} WIB</td></tr>
          </table>
          <p style="font-size:12px;color:#9ca3af;margin-top:16px">Email ini dikirim otomatis oleh sistem SOS ${eventName}.</p>
        </div>
      </div>
    `,
  });
}

// ── CR-041: OTP email ─────────────────────────────────────────────────────────

async function sendOTPEmail(toEmail, otpCode, userName) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const ttl = process.env.OTP_TTL_MINUTES || '5';
  const eventName = await _getEventName();

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Kode Verifikasi Login: ${otpCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1f2937;padding:20px 24px">
          <h2 style="color:#fff;margin:0;font-size:18px">🔐 Kode Verifikasi Login</h2>
          <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">${eventName}</p>
        </div>
        <div style="padding:28px 24px">
          <p style="color:#374151;font-size:14px;margin:0 0 20px">
            Halo <strong>${userName}</strong>,<br>
            Gunakan kode berikut untuk menyelesaikan login dari perangkat baru:
          </p>
          <div style="text-align:center;margin:24px 0">
            <span style="font-size:42px;font-weight:800;letter-spacing:10px;color:#111827;font-family:monospace">${otpCode}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;margin:0 0 20px">
            Kode berlaku selama <strong>${ttl} menit</strong> dan hanya dapat digunakan sekali.
          </p>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px">
            <p style="color:#92400e;font-size:12px;margin:0">
              ⚠️ <strong>Bukan Anda yang login?</strong> Abaikan email ini dan segera ganti password Anda. Hubungi admin jika perlu.
            </p>
          </div>
        </div>
        <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:11px;margin:0">Email otomatis — jangan reply. ${eventName} &copy;</p>
        </div>
      </div>
    `,
  });
}

async function sendNewDeviceAlert(toEmail, deviceInfo) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const { browser = '-', ipAddress = '-', loginAt } = deviceInfo;
  const time = loginAt
    ? new Date(loginAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
    : '-';
  const eventName = await _getEventName();

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Login dari Perangkat Baru Terdeteksi`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1f2937;padding:20px 24px">
          <h2 style="color:#fff;margin:0;font-size:18px">🖥️ Login Perangkat Baru</h2>
          <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">${eventName}</p>
        </div>
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            Login berhasil dari perangkat baru yang telah diverifikasi:
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px">Browser</td><td style="padding:6px 0;font-weight:600">${browser}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">IP Address</td><td style="padding:6px 0">${ipAddress}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Waktu</td><td style="padding:6px 0">${time} WIB</td></tr>
          </table>
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-top:16px">
            <p style="color:#991b1b;font-size:12px;margin:0">
              ⚠️ <strong>Bukan Anda?</strong> Segera hubungi administrator untuk mencabut akses perangkat ini.
            </p>
          </div>
        </div>
        <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:11px;margin:0">Email otomatis — jangan reply. ${eventName} &copy;</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendLoginAlert, sendOTPEmail, sendNewDeviceAlert };
