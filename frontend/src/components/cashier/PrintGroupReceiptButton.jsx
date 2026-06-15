import React, { useRef } from 'react';
import ThermalGroupReceipt from './ThermalGroupReceipt';

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
  groupCode,
  customer,
  boothBreakdown,
  totalAmount,
  cashReceived,
  cashChange,
  paymentMethod,
  paymentRef,
  cashierName,
  paidAt,
  transactionIds,
}) {
  const receiptRef = useRef(null);

  function handlePrint() {
    const el = receiptRef.current;
    if (!el) return;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
@page { size: 80mm auto; margin: 3mm; }
body { width: 274px; margin: 0 auto; padding: 6px; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
svg { display: block; }
</style></head><body>${el.innerHTML}</body></html>`;

    const win = window.open('', '_blank', 'width=340,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 border border-emerald-600 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <PrinterIcon />
        Cetak
      </button>

      {/* Off-screen receipt rendered into DOM so innerHTML can be captured */}
      <div
        ref={receiptRef}
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '274px', background: '#fff' }}
        aria-hidden="true"
      >
        <ThermalGroupReceipt
          groupCode={groupCode}
          customer={customer}
          boothBreakdown={boothBreakdown}
          totalAmount={totalAmount}
          cashReceived={cashReceived}
          cashChange={cashChange}
          paymentMethod={paymentMethod}
          paymentRef={paymentRef}
          cashierName={cashierName}
          paidAt={paidAt}
          transactionIds={transactionIds}
        />
      </div>
    </>
  );
}
