import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import ThermalReceipt from './ThermalReceipt';
import { directPrintReceipt } from '../../api/print';

// ── Browser print fallback ────────────────────────────────────────────────────
function printReceiptFromHtml(innerHtml) {
  const printWin = window.open(
    '',
    '_blank',
    'width=420,height=700,toolbar=0,location=0,status=0,menubar=0,scrollbars=0',
  );
  if (!printWin) return;

  printWin.document.open();
  printWin.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
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
  </style>
</head>
<body>${innerHtml}</body>
</html>`);
  printWin.document.close();

  const doPrint = () => { printWin.focus(); printWin.print(); printWin.close(); };
  printWin.onload = doPrint;
}

// ── Status indicator ──────────────────────────────────────────────────────────
function PrintStatusBadge({ status }) {
  if (status === 'printing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Mencetak…
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        </svg>
        Berhasil dicetak
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
        Printer error
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
  const [printStatus, setPrintStatus] = useState(null); // null | 'printing' | 'success' | 'error'
  const [printError,  setPrintError]  = useState('');
  const modalRef   = useRef(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (isOpen) { setSendEmail(false); setPrintStatus(null); setPrintError(''); }
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

  const hasEmail   = !!customer?.email;
  const isPrinting = printStatus === 'printing';

  // ESC/POS direct print — calls backend
  async function handleDirectPrint() {
    setPrintStatus('printing');
    setPrintError('');
    try {
      await directPrintReceipt({ txn, success, cashierName, customer, cashReceived });
      setPrintStatus('success');
      onConfirmPrint(sendEmail);
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message ?? 'Printer tidak tersedia.';
      setPrintError(msg);
      setPrintStatus('error');
    }
  }

  // Browser print — uses rendered HTML preview
  function handleBrowserPrint() {
    const html = receiptRef.current?.innerHTML;
    if (html) printReceiptFromHtml(html);
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

        {/* Printer error message */}
        {printStatus === 'error' && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <span className="font-medium">Gagal:</span> {printError}
            <span className="block mt-0.5 text-red-600">
              Gunakan <strong>Browser Print</strong> di bawah sebagai alternatif.
            </span>
          </div>
        )}

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
          {/* Primary: ESC/POS direct print */}
          <button
            type="button"
            onClick={handleDirectPrint}
            disabled={isPrinting || printStatus === 'success'}
            className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors
              ${isPrinting || printStatus === 'success'
                ? 'bg-emerald-400 text-white cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            {isPrinting ? 'Mencetak…' : printStatus === 'success' ? 'Dicetak' : 'Print Langsung (ESC/POS)'}
          </button>

          {/* Secondary row: browser print + cancel */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBrowserPrint}
              disabled={isPrinting}
              className="flex-1 border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Browser Print
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
            ESC/POS membutuhkan printer terhubung ke jaringan (IP dikonfigurasi admin).
            <br/>Gunakan <em>Browser Print</em> jika printer belum terhubung.
          </p>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
