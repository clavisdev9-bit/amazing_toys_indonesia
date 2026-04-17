import React from 'react';

function PrinterIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

export default function PrintReceiptButton({ txn, onOpenModal }) {
  const disabled = !txn;
  return (
    <button
      type="button"
      onClick={onOpenModal}
      disabled={disabled}
      className={`inline-flex items-center gap-2 bg-white text-emerald-700 border border-emerald-600
        rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-50
        focus:outline-none focus:ring-2 focus:ring-emerald-500
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <PrinterIcon />
      Print receipt
    </button>
  );
}
