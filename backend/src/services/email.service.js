'use strict';

const mailer             = require('../config/mailer');
const { getSystemConfig } = require('../modules/admin/admin.service');

async function _getEventName() {
  const cfg = await getSystemConfig();
  return cfg.event_name || 'SOS';
}

async function _smtpReady() {
  return mailer.isReady();
}

async function _getFrom() {
  const { from } = await mailer.getConfig();
  return from || '';
}

async function _getNotifyTo() {
  const { notifyTo } = await mailer.getConfig();
  return notifyTo || '';
}

function _formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

function _footer(eventName) {
  return `<div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
    <p style="color:#9ca3af;font-size:11px;margin:0">Email otomatis — jangan reply. ${eventName} &copy;</p>
  </div>`;
}

function _header(title, subtitle, eventName) {
  return `<div style="background:#1f2937;padding:20px 24px">
    <h2 style="color:#fff;margin:0;font-size:18px">${title}</h2>
    <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">${subtitle || eventName}</p>
  </div>`;
}

// ── Staff notifications ───────────────────────────────────────────────────────

async function sendLoginAlert({ username, role, name, loginAt }) {
  if (!await _smtpReady()) return;

  const roleLabel = { CASHIER: 'Kasir', TENANT: 'Tenant', LEADER: 'Leader', ADMIN: 'Admin' }[role] ?? role;
  const time = loginAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
  const eventName = await _getEventName();
  const notifyTo  = await _getNotifyTo();
  if (!notifyTo) return;

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      notifyTo,
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

async function sendOTPEmail(toEmail, otpCode, userName) {
  if (!await _smtpReady()) return;

  const ttl = process.env.OTP_TTL_MINUTES || '5';
  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Kode Verifikasi Login: ${otpCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🔐 Kode Verifikasi Login', null, eventName)}
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
        ${_footer(eventName)}
      </div>
    `,
  });
}

async function sendNewDeviceAlert(toEmail, deviceInfo) {
  if (!await _smtpReady()) return;

  const { browser = '-', ipAddress = '-', loginAt } = deviceInfo;
  const time = loginAt
    ? new Date(loginAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
    : '-';
  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Login dari Perangkat Baru Terdeteksi`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🖥️ Login Perangkat Baru', null, eventName)}
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
        ${_footer(eventName)}
      </div>
    `,
  });
}

// ── Customer notifications ────────────────────────────────────────────────────

/**
 * OTP customer (registrasi atau login).
 * Menggunakan TTL dari env OTP_TTL_MINUTES.
 * Fire-and-forget safe — caller harus .catch().
 */
async function sendCustomerOTPEmail(toEmail, otpCode, customerName) {
  if (!await _smtpReady() || !toEmail) return;

  const ttl = process.env.OTP_TTL_MINUTES || '5';
  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Kode OTP Anda: ${otpCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🔑 Kode Verifikasi', null, eventName)}
        <div style="padding:28px 24px">
          <p style="color:#374151;font-size:14px;margin:0 0 20px">
            Halo <strong>${customerName}</strong>,<br>
            Gunakan kode OTP berikut untuk melanjutkan:
          </p>
          <div style="text-align:center;margin:24px 0">
            <span style="font-size:42px;font-weight:800;letter-spacing:10px;color:#111827;font-family:monospace">${otpCode}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;margin:0 0 20px">
            Kode berlaku selama <strong>${ttl} menit</strong> dan hanya dapat digunakan sekali.
          </p>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px">
            <p style="color:#92400e;font-size:12px;margin:0">
              ⚠️ Jika Anda tidak meminta kode ini, abaikan email ini.
            </p>
          </div>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Sambutan customer yang baru berhasil terdaftar.
 * Fire-and-forget safe.
 */
async function sendCustomerGreetingEmail(toEmail, customerName) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();
  const cfg = await getSystemConfig();
  const venue    = cfg.venue            || '';
  const dateStart = cfg.event_date_start || '';
  const dateEnd   = cfg.event_date_end   || '';

  const scheduleHtml = (dateStart && dateEnd)
    ? `<tr><td style="padding:6px 0;color:#6b7280;width:100px">Jadwal</td><td style="padding:6px 0">${dateStart} – ${dateEnd}</td></tr>`
    : '';
  const venueHtml = venue
    ? `<tr><td style="padding:6px 0;color:#6b7280">Lokasi</td><td style="padding:6px 0">${venue}</td></tr>`
    : '';

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Selamat Datang, ${customerName}! 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🎉 Selamat Datang!', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            Halo <strong>${customerName}</strong>!<br><br>
            Akun Anda sudah berhasil terdaftar di <strong>${eventName}</strong>. Nikmati pengalaman berbelanja terbaik! 🧸
          </p>
          ${(scheduleHtml || venueHtml) ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f9fafb;border-radius:8px;padding:12px 16px">
            ${scheduleHtml}${venueHtml}
          </table>` : ''}
          <p style="color:#374151;font-size:13px;margin-top:16px">Selamat berbelanja! 🛍️</p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi akun terkunci setelah terlalu banyak percobaan login gagal.
 * Fire-and-forget safe.
 */
async function sendCustomerLockoutEmail(toEmail, customerName, lockoutMinutes = 5) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Peringatan: Akun Anda Terkunci Sementara`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🔒 Akun Terkunci Sementara', null, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            Halo <strong>${customerName}</strong>,
          </p>
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            Akun Anda terkunci sementara selama <strong>${lockoutMinutes} menit</strong>
            karena terlalu banyak percobaan login yang gagal.
          </p>
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px">
            <p style="color:#991b1b;font-size:12px;margin:0">
              ⚠️ <strong>Bukan Anda?</strong> Segera hubungi petugas booth <strong>${eventName}</strong>.
            </p>
          </div>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">
            Setelah ${lockoutMinutes} menit, Anda dapat mencoba login kembali.
          </p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

// ── Pre-Order email notifications ─────────────────────────────────────────────

/**
 * Konfirmasi pembayaran pre-order.
 * Fire-and-forget safe.
 */
async function sendPreorderConfirmedEmail(toEmail, customerName, total, estimasiNote = '') {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();
  const estHtml = estimasiNote
    ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;margin-top:12px">
         <p style="color:#166534;font-size:13px;margin:0">📋 ${estimasiNote}</p>
       </div>`
    : '';

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Pembayaran Pre-Order Dikonfirmasi ✅`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('✅ Pembayaran Dikonfirmasi', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 12px">Halo <strong>${customerName}</strong>,</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">
            Pembayaran Pre-Order sebesar <strong>${total}</strong> telah dikonfirmasi.
            Barang akan dikirim setelah siap.
          </p>
          ${estHtml}
          <p style="color:#6b7280;font-size:13px;margin-top:16px">
            Kami akan menghubungi Anda kembali saat barang dikirim.
          </p>
          <p style="color:#374151;font-size:13px">Terima kasih berbelanja di <strong>${eventName}</strong>! 🧸</p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi barang pre-order dikirim.
 * Fire-and-forget safe.
 */
async function sendPreorderShippedEmail(toEmail, customerName, courier, trackingNumber) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Barang Pre-Order Anda Dikirim 📦`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('📦 Barang Dikirim!', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 16px">Halo <strong>${customerName}</strong>,</p>
          <p style="color:#374151;font-size:14px;margin:0 0 16px">Pesanan Pre-Order Anda sudah dalam perjalanan.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px">Ekspedisi</td><td style="padding:6px 0;font-weight:600">${courier || '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">No. Resi</td><td style="padding:6px 0;font-weight:600">${trackingNumber || '-'}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">Estimasi tiba 3–5 hari kerja.</p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi barang pre-order sudah sampai di Indonesia.
 * Fire-and-forget safe.
 */
async function sendPreorderArrivedEmail(toEmail, customerName) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Barang Anda Sudah Sampai di Indonesia 📍`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('📍 Barang Sudah Tiba!', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 12px">Halo <strong>${customerName}</strong>,</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">
            Barang Pre-Order Anda telah tiba di Indonesia.
            Tim kami akan segera menghubungi Anda untuk jadwal penyerahan barang.
          </p>
          <p style="color:#374151;font-size:13px">Terima kasih atas kesabaran Anda! 🙏</p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi barang pre-order sudah diserahkan ke customer.
 * Fire-and-forget safe.
 */
async function sendPreorderCompletedEmail(toEmail, customerName) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Transaksi Pre-Order Selesai 🤝`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🤝 Transaksi Selesai!', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 12px">Halo <strong>${customerName}</strong>,</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">
            Transaksi Pre-Order Anda telah selesai. Barang sudah diserahkan. 🎉
          </p>
          <p style="color:#374151;font-size:13px">
            Terima kasih telah berbelanja di <strong>${eventName}</strong>!<br>
            Sampai jumpa di event berikutnya! 🧸
          </p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi pre-order dibatalkan.
 * Fire-and-forget safe.
 */
async function sendPreorderCancelledEmail(toEmail, customerName) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Pre-Order Dibatalkan ❌`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('❌ Pre-Order Dibatalkan', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 12px">Halo <strong>${customerName}</strong>,</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">
            Pesanan Pre-Order Anda telah dibatalkan oleh helper.
          </p>
          <p style="color:#374151;font-size:13px">
            Jika ada pertanyaan, silakan hubungi petugas booth <strong>${eventName}</strong>.
          </p>
          <p style="color:#374151;font-size:13px">Terima kasih 🙏</p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi pre-order kedaluwarsa.
 * Fire-and-forget safe.
 */
async function sendPreorderExpiredEmail(toEmail, customerName) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Pre-Order Kedaluwarsa ⏰`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('⏰ Pre-Order Kedaluwarsa', eventName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 12px">Halo <strong>${customerName}</strong>,</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">
            Pesanan Pre-Order Anda telah kedaluwarsa karena melewati batas waktu pembayaran.
          </p>
          <p style="color:#374151;font-size:13px">
            Silakan buat pesanan baru atau hubungi petugas booth <strong>${eventName}</strong>.
          </p>
          <p style="color:#374151;font-size:13px">Terima kasih 🙏</p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

/**
 * Notifikasi order QR ke customer via email.
 * Fire-and-forget safe.
 */
async function sendCustomerOrderQREmail(toEmail, { boothName, itemSummary, totalAmount, orderLink, expiryMinutes }) {
  if (!await _smtpReady() || !toEmail) return;

  const eventName = await _getEventName();
  const total = _formatRupiah(totalAmount);

  await mailer.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `[${eventName}] Pesanan Anda Siap — Tunjukkan QR ke Kasir`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${_header('🛍️ Pesanan Siap', boothName, eventName)}
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;margin:0 0 16px">Pesanan Anda dari <strong>${boothName}</strong> sudah dibuat.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280;width:80px">Item</td><td style="padding:6px 0">${itemSummary}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Total</td><td style="padding:6px 0;font-weight:600">${total}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0">
            <a href="${orderLink}" style="background:#1f2937;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
              Lihat QR Pesanan
            </a>
          </div>
          <p style="color:#6b7280;font-size:12px;text-align:center">
            Link berlaku ${expiryMinutes} menit. Tunjukkan QR ke kasir untuk pembayaran.
          </p>
        </div>
        ${_footer(eventName)}
      </div>
    `,
  });
}

module.exports = {
  // Staff
  sendLoginAlert,
  sendOTPEmail,
  sendNewDeviceAlert,
  // Customer
  sendCustomerOTPEmail,
  sendCustomerGreetingEmail,
  sendCustomerLockoutEmail,
  sendCustomerOrderQREmail,
  // Pre-Order
  sendPreorderConfirmedEmail,
  sendPreorderShippedEmail,
  sendPreorderArrivedEmail,
  sendPreorderCompletedEmail,
  sendPreorderCancelledEmail,
  sendPreorderExpiredEmail,
};
