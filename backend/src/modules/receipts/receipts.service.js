'use strict';

const transporter = require('../../config/mailer');

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

async function sendEReceiptEmail({ to, customerName, transactionId, eventName, eventVenue, cashier, createdAt, paymentMethod, items, totalAmount, note }) {
  const itemRows = (items ?? []).map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px">${item.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right">${formatRupiah(item.priceIncludingTax)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">${item.tenant ?? ''}</td>
    </tr>
  `).join('');

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
    : '-';

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject: `E-Receipt #${transactionId} — ${eventName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1f2937;padding:20px 24px">
          <h2 style="color:#fff;margin:0;font-size:18px">🧾 E-Receipt Pembelian</h2>
          <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">${eventName} · ${eventVenue}</p>
        </div>

        <div style="padding:24px">
          <p style="font-size:14px;color:#374151;margin:0 0 16px">Halo <strong>${customerName}</strong>, terima kasih telah berbelanja!</p>

          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
            <tr>
              <td style="padding:4px 0;color:#6b7280;width:140px">ID Transaksi</td>
              <td style="padding:4px 0;font-family:monospace;font-weight:600">${transactionId}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b7280">Tanggal</td>
              <td style="padding:4px 0">${dateStr} WIB</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b7280">Metode Bayar</td>
              <td style="padding:4px 0">${paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b7280">Kasir</td>
              <td style="padding:4px 0">${cashier || '-'}</td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <thead>
              <tr style="border-bottom:2px solid #e5e7eb">
                <th style="padding:6px 0;text-align:left;font-size:12px;color:#6b7280;font-weight:600">PRODUK</th>
                <th style="padding:6px 0;text-align:center;font-size:12px;color:#6b7280;font-weight:600">QTY</th>
                <th style="padding:6px 0;text-align:right;font-size:12px;color:#6b7280;font-weight:600">HARGA</th>
                <th style="padding:6px 0;text-align:left;font-size:12px;color:#6b7280;font-weight:600;padding-left:8px">TENANT</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div style="border-top:2px solid #1f2937;padding-top:12px;display:flex;justify-content:space-between;font-size:15px;font-weight:700">
            <span>Total</span>
            <span>${formatRupiah(totalAmount)}</span>
          </div>
          ${note ? `<p style="font-size:11px;color:#9ca3af;margin-top:8px">* ${note}</p>` : ''}
        </div>

        <div style="background:#f9fafb;padding:12px 24px;text-align:center">
          <p style="font-size:11px;color:#9ca3af;margin:0">Email ini dikirim otomatis. Simpan sebagai bukti pembelian Anda.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendEReceiptEmail };
