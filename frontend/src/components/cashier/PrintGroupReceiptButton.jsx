import React from 'react';
import { formatRupiah } from '../../utils/format';

function PrinterIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

export default function PrintGroupReceiptButton({
  groupCode, customer, selectedTrx, boothBreakdown,
  totalAmount, paymentMethod, cashierName, paidAt,
}) {
  function handlePrint() {
    const paidDate = paidAt ? new Date(paidAt).toLocaleString('id-ID') : '-';

    const boothRows = Object.entries(boothBreakdown ?? {}).map(([booth, items]) => `
      <tr><td colspan="3" style="padding:6px 0 2px;font-weight:700;color:#1d4ed8;font-size:11px">${booth}</td></tr>
      ${items.map(item => `
        <tr>
          <td style="padding:1px 0;font-size:11px">${item.product_name}</td>
          <td style="text-align:center;font-size:11px">×${item.quantity}</td>
          <td style="text-align:right;font-size:11px">${formatRupiah(item.subtotal)}</td>
        </tr>
      `).join('')}
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>
      body{font-family:monospace;font-size:12px;margin:0;padding:12px;width:280px}
      h2{font-size:14px;text-align:center;margin:0 0 4px}
      .center{text-align:center}.divider{border-top:1px dashed #999;margin:8px 0}
      table{width:100%;border-collapse:collapse}
      .group-code{font-size:16px;font-weight:900;text-align:center;font-family:monospace;margin:6px 0}
      .total-row td{font-weight:900;font-size:13px;border-top:1px solid #333;padding-top:6px}
    </style></head><body>
    <h2>INVOICE GROUP</h2>
    <div class="group-code">${groupCode}</div>
    <div class="center" style="font-size:11px;color:#555;margin-bottom:6px">${customer?.name ?? ''} · ${customer?.phone ?? ''}</div>
    <div class="divider"></div>
    <table>
      ${boothRows}
      <tr class="total-row">
        <td>TOTAL</td><td></td>
        <td style="text-align:right">${formatRupiah(totalAmount)}</td>
      </tr>
    </table>
    <div class="divider"></div>
    <div style="font-size:10px">Metode: ${paymentMethod}</div>
    <div style="font-size:10px">Kasir: ${cashierName}</div>
    <div style="font-size:10px">Waktu: ${paidDate}</div>
    <div class="divider"></div>
    <div class="center" style="font-size:10px">Tunjukkan struk ini di setiap booth</div>
    <div class="center" style="font-size:10px">untuk mengambil barang Anda.</div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 border border-emerald-600 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <PrinterIcon />
      Cetak
    </button>
  );
}
