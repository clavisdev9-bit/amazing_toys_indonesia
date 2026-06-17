import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import ThermalReceipt from './ThermalReceipt';

// ── Download receipt as HTML file ─────────────────────────────────────────────
function downloadReceiptAsHtml(innerHtml, txnId) {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Receipt ${txnId}</title>
  <style>
    *  { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 80mm auto; margin: 0; }
    html { width: 80mm; }
    body {
      width: 80mm;
      padding: 4mm 4mm 8mm;
      background: #fff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * {
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: unset;
      text-rendering: optimizeSpeed;
    }
    #print-btn {
      display: block;
      width: 100%;
      margin-bottom: 10px;
      padding: 8px 0;
      background: #000;
      color: #fff;
      font-family: Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      letter-spacing: 0.5px;
    }
    #print-btn:hover { background: #333; }
    @media print { #print-btn { display: none; } }
  </style>
</head>
<body>
  <button id="print-btn" onclick="window.print()">🖨️ Print Receipt</button>
  ${innerHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `receipt-${txnId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Status indicator ──────────────────────────────────────────────────────────
function PrintStatusBadge({ status }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        </svg>
        Dialog cetak dibuka
      </span>
    );
  }
  return null;
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function PrintConfirmationModal({
  isOpen,
  txn,
  success,
  cashierName,
  customer,
  cashReceived,
  onClose,
  onConfirmPrint,
}) {
  const [sendEmail,   setSendEmail]   = useState(false);
  const [printStatus, setPrintStatus] = useState(null); // null | 'done'
  const modalRef   = useRef(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (isOpen) { setSendEmail(false); setPrintStatus(null); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length) focusable[0].focus();
  }, [isOpen]);

  if (!isOpen || !txn) return null;

  const hasEmail = !!customer?.email;

  // Print via browser print dialog (PDF-capable)
  function handlePrintPdf() {
    const innerHtml = receiptRef.current?.innerHTML;
    if (!innerHtml) return;
    const win = window.open('', '_blank', 'width=420,height=700,scrollbars=yes');
    if (!win) { alert('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini.'); return; }
    win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Receipt ${txn?.transaction_id ?? ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 80mm auto; margin: 0; }
    html { width: 80mm; }
    body {
      width: 80mm;
      padding: 4mm 4mm 8mm;
      background: #fff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * { -webkit-font-smoothing: none; -moz-osx-font-smoothing: unset; text-rendering: optimizeSpeed; }
  </style>
</head>
<body>${innerHtml}</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    setPrintStatus('done');
    onConfirmPrint(sendEmail);
  }

  // Download receipt as HTML file — uses rendered HTML preview
  function handleDownloadHtml() {
    const html = receiptRef.current?.innerHTML;
    if (html) downloadReceiptAsHtml(html, txn?.transaction_id ?? 'receipt');
    onConfirmPrint(sendEmail);
  }

  const content = (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              Print receipt?
            </h2>
            <PrintStatusBadge status={printStatus} />
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Thermal receipt preview */}
        <div className="border border-dashed border-gray-300 rounded-lg mt-4 bg-[#e8e4dc] max-h-[380px] overflow-y-auto">
          <div
            ref={receiptRef}
            style={{ width: '274px', margin: '0 auto', padding: '14px 0 18px' }}
          >
            <ThermalReceipt
              txn={txn}
              success={success}
              cashierName={cashierName}
              customer={customer}
              cashReceived={cashReceived}
              qrSize={90}
            />
          </div>
        </div>

        {/* E-receipt checkbox */}
        {hasEmail && (
          <div className="flex items-center gap-2 mt-4">
            <input
              id="send-email-checkbox"
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="send-email-checkbox" className="text-sm text-gray-700">
              Kirim e-receipt ke {customer.email}
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 space-y-2">
          {/* Primary: Print PDF via browser dialog */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Print / Simpan PDF
          </button>

          {/* Secondary row: download HTML + cancel */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download HTML
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50"
            >
              Batal
            </button>
          </div>

          {/* Hint text */}
          <p className="text-center text-xs text-gray-400 pt-1">
            <strong>Print / Simpan PDF</strong> membuka dialog cetak browser.
            Pilih printer untuk cetak langsung, atau pilih <em>"Save as PDF"</em> untuk simpan file.
          </p>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
