import { useState } from 'react';
import { validateVoucher } from '../../api/vouchers';
import { formatRupiah } from '../../utils/format';

const ERROR_MESSAGES = {
  VOUCHER_NOT_FOUND:      'Kode voucher tidak ditemukan',
  VOUCHER_EXPIRED:        'Voucher sudah tidak berlaku',
  VOUCHER_USAGE_LIMIT:    'Voucher sudah habis digunakan',
  ALREADY_USED:           'Kamu sudah pernah menggunakan voucher ini',
  VOUCHER_NOT_APPLICABLE: 'Voucher tidak berlaku untuk produk ini',
};

// items: [{ price, quantity, tenant_id }] — needed so backend can scope discount to restricted tenant
export default function VoucherInput({ cartTotal, tenantIds, items, onVoucherApplied, onVoucherRemoved }) {
  const [inputCode, setInputCode]           = useState('');
  const [status, setStatus]                 = useState('idle'); // idle | loading | valid | invalid
  const [errorMessage, setErrorMessage]     = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  async function handleApply() {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const cartItems = (items || []).map(i => ({
        price:     i.price,
        quantity:  i.quantity,
        tenant_id: i.tenant_id,
      }));
      const res = await validateVoucher({
        code,
        cart_total:  cartTotal,
        tenant_ids:  tenantIds || [],
        items:       cartItems,
      });
      const data = res.data.data;
      setAppliedVoucher(data);
      setStatus('valid');
      onVoucherApplied(data);
    } catch (err) {
      const errCode = err.response?.data?.error?.code || 'UNKNOWN';
      const minPurchase = err.response?.data?.error?.minPurchase;
      const msg = errCode === 'MIN_PURCHASE_NOT_MET' && minPurchase
        ? `Minimum belanja ${formatRupiah(minPurchase)}`
        : (ERROR_MESSAGES[errCode] || 'Kode voucher tidak valid');
      setErrorMessage(msg);
      setStatus('invalid');
    }
  }

  function handleRemove() {
    setAppliedVoucher(null);
    setInputCode('');
    setStatus('idle');
    setErrorMessage('');
    onVoucherRemoved();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleApply();
  }

  if (appliedVoucher) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-600 text-lg shrink-0">🏷️</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-800 truncate">
              Voucher {appliedVoucher.code}
            </p>
            <p className="text-xs text-green-600">
              Hemat {formatRupiah(appliedVoucher.discount_amount)}
            </p>
          </div>
        </div>
        <button
          onClick={handleRemove}
          className="ml-2 shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1"
          aria-label="Hapus voucher"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputCode}
          onChange={(e) => {
            setInputCode(e.target.value.toUpperCase());
            if (status === 'invalid') { setStatus('idle'); setErrorMessage(''); }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Kode voucher"
          className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono tracking-wider uppercase
            focus:outline-none focus:ring-2 transition-colors
            ${status === 'invalid'
              ? 'border-red-300 focus:ring-red-200 bg-red-50'
              : 'border-gray-200 focus:ring-blue-200 bg-white'
            }`}
          disabled={status === 'loading'}
        />
        <button
          onClick={handleApply}
          disabled={status === 'loading' || !inputCode.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {status === 'loading' ? '...' : 'Pakai'}
        </button>
      </div>
      {status === 'invalid' && errorMessage && (
        <p className="text-xs text-red-600 px-1">{errorMessage}</p>
      )}
    </div>
  );
}
