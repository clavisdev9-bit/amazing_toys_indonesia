import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { formatRupiah, formatDate } from '../../utils/format';

const EVENT_NAME = 'Amazing Toys Fair 2026';
const EVENT_VENUE = 'JCC Senayan, Jakarta';

export default function PrintConfirmationModal({
  isOpen,
  txn,
  success,
  cashierName,
  customer,
  onClose,
  onConfirmPrint,
}) {
  const [sendEmail, setSendEmail] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) setSendEmail(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }, [isOpen]);

  if (!isOpen || !txn) return null;

  const hasEmail = !!customer?.email;
  const paidAt = success?.paidAt ?? txn.checkout_time;

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
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            Print receipt?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Receipt preview */}
        <div className="border border-dashed border-gray-300 rounded-lg p-4 mt-4 bg-gray-50 max-h-72 overflow-y-auto">
          <p className="text-center font-bold text-sm">{EVENT_NAME}</p>
          <p className="text-center text-xs text-gray-500 mb-3">{EVENT_VENUE}</p>

          <div className="font-mono text-xs text-gray-500 space-y-0.5">
            <p>ID: {txn.transaction_id}</p>
            <p>Tgl: {formatDate(paidAt)}</p>
            <p>Kasir: {cashierName}</p>
          </div>

          <div className="border-t border-dashed my-2" />

          {(txn.items ?? []).map((item, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5">
              <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
              <span>{formatRupiah(item.unit_price * item.quantity)}</span>
            </div>
          ))}

          <div className="border-t border-gray-300 my-2" />

          <div className="flex justify-between text-xs font-bold">
            <span>Total</span>
            <span>{formatRupiah(txn.total_amount)}</span>
          </div>

          <p className="text-xs text-gray-400 text-center mt-2">All prices include tax</p>
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
              Send e-receipt to {customer.email}
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirmPrint(sendEmail)}
            className="bg-emerald-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
