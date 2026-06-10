import React from 'react';
import { formatRupiah } from '../../utils/format';
import { usePublicConfig } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

export default function StockApprovalModal({ approvedItems, waitingItems, onConfirm, onCancel }) {
  const config  = usePublicConfig();
  const ppnRate = parseFloat(config?.ppn_rate) || 0;
  const { t }   = useLang();

  function itemTotal(item) {
    return Math.round(item.price * item.quantity * (1 + ppnRate / 100));
  }

  const approvedTotal = approvedItems.reduce((s, i) => s + itemTotal(i), 0);
  const allOnHold     = approvedItems.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(10,15,45,0.58)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
        onClick={onCancel}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 -8px 40px rgba(59,91,219,0.18), 0 0 0 1px rgba(255,255,255,0.9)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,183,0,0.13)', border: '1px solid rgba(230,119,0,0.2)' }}
            >
              <span className="text-lg">⚠️</span>
            </div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">
              {t('cart.approvalTitle')}
            </h2>
          </div>
          <p className="text-[13px] text-gray-500 leading-relaxed pl-12">
            {t('cart.approvalDesc')}
          </p>
        </div>

        {/* Two-column item list */}
        <div className="px-5 pb-3 grid grid-cols-2 gap-3">
          {/* Approved */}
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'rgba(235,252,245,0.8)',
              border: '1px solid rgba(8,127,91,0.18)',
            }}
          >
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2.5">
              {t('cart.readyToProcess')}
            </p>
            {approvedItems.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic">{t('cart.noItems')}</p>
            ) : (
              <div className="space-y-2.5">
                {approvedItems.map((item) => (
                  <div key={item.product_id} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 text-[13px] mt-px shrink-0">✓</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-snug">
                        {item.product_name}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                        {item.quantity > 1 && `${item.quantity}× `}{formatRupiah(itemTotal(item))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waiting */}
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'rgba(255,248,220,0.85)',
              border: '1px solid rgba(230,119,0,0.2)',
            }}
          >
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2.5">
              {t('cart.awaitingConfirmation')}
            </p>
            <div className="space-y-2.5">
              {waitingItems.map((item) => (
                <div key={item.product_id} className="flex items-start gap-1.5">
                  <span className="text-amber-500 text-[12px] mt-px shrink-0">⏳</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-700 line-clamp-2 leading-snug">
                      {item.product_name}
                    </p>
                    <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                      {item.quantity > 1 && `${item.quantity}× `}{formatRupiah(itemTotal(item))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="px-5 mb-3">
          <div
            className="rounded-xl px-3.5 py-3 flex items-start gap-2.5"
            style={{ background: 'rgba(59,91,219,0.06)', border: '1px solid rgba(59,91,219,0.13)' }}
          >
            <span className="text-blue-400 shrink-0 text-sm mt-px">💾</span>
            <p className="text-[12px] text-blue-800 leading-relaxed">
              {t('cart.onHoldSavedNote')}
            </p>
          </div>
        </div>

        {/* Total row */}
        {!allOnHold && (
          <div className="px-5 mb-1">
            <div
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
              style={{ background: 'rgba(235,252,245,0.5)', border: '1px solid rgba(8,127,91,0.12)' }}
            >
              <span className="text-[12px] text-gray-500">
                {t('cart.totalReadyItems', { count: approvedItems.length })}
              </span>
              <span className="text-[15px] font-extrabold text-blue-700">
                {formatRupiah(approvedTotal)}
              </span>
            </div>
          </div>
        )}

        {/* All on hold warning */}
        {allOnHold && (
          <div className="px-5 mb-1">
            <div
              className="px-3.5 py-2.5 rounded-xl text-center"
              style={{ background: 'rgba(255,235,210,0.7)', border: '1px solid rgba(230,119,0,0.2)' }}
            >
              <p className="text-[12px] text-amber-800 font-semibold">
                {t('cart.allOnHold')}
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                {t('cart.checkoutUnavailable')}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-5 pb-7 pt-3 flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl text-[13px] font-semibold transition-opacity active:opacity-70"
            style={{
              background: 'rgba(215,220,235,0.7)',
              color: '#4b5a72',
              border: '1px solid rgba(195,205,225,0.7)',
            }}
          >
            {t('common.back')}
          </button>
          {!allOnHold && (
            <button
              onClick={onConfirm}
              className="flex-[1.6] py-3.5 rounded-2xl text-[13px] font-bold text-white transition-opacity active:opacity-80"
              style={{
                background: 'linear-gradient(135deg, #3B5BDB 0%, #4C6EF5 100%)',
                boxShadow: '0 4px 18px rgba(59,91,219,0.38)',
                border: '1px solid rgba(116,143,252,0.4)',
              }}
            >
              {t('cart.continueCheckout')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
