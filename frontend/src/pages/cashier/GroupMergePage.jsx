'use strict';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatRupiah, formatDate } from '../../utils/format';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

export default function GroupMergePage() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // State passed from CashierDashboardPage
  const { transactions = [], scannedId = null } = location.state ?? {};

  const [selected, setSelected] = useState(() => new Set(transactions.map(t => t.transaction_id)));

  // If landed without state, redirect back
  useEffect(() => {
    if (!transactions.length) navigate('/cashier', { replace: true });
  }, [transactions.length, navigate]);

  const customer = transactions[0] ?? {};
  const customerName  = customer.customer_name  || 'Walk-in';
  const customerPhone = customer.customer_phone || customer.walk_in_phone || '-';

  const selectedTrx = useMemo(
    () => transactions.filter(t => selected.has(t.transaction_id)),
    [transactions, selected],
  );
  const total = selectedTrx.reduce((s, t) => s + parseFloat(t.total_amount), 0);
  const booths = [...new Set(selectedTrx.map(t => t.booth_location).filter(Boolean))];

  function toggle(id) {
    setSelected(prev => {
      if (prev.has(id) && prev.size === 1) return prev; // minimal 1
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function proceed() {
    navigate('/cashier/group-bayar', {
      state: { selectedTrx, allTrx: transactions, customer: { name: customerName, phone: customerPhone } },
    });
  }

  const isSingle = transactions.length === 1;

  return (
    <div className="max-w-lg">
      <button
        onClick={() => navigate('/cashier')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-4"
      >
        ← Kembali ke Dashboard
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-4">Pilih Transaksi</h1>

      {/* Customer info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
        <p className="font-bold text-blue-900 text-base">{customerName}</p>
        <p className="text-sm text-blue-700 mt-0.5">📱 {customerPhone}</p>
      </div>

      {/* Alert */}
      {isSingle ? (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
          <span className="text-lg shrink-0">ℹ️</span>
          <span>Customer ini hanya memiliki <strong>1 transaksi aktif</strong>. Akan dibuatkan invoice tunggal.</span>
        </div>
      ) : (
        <div className="flex gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 mb-4 text-sm text-violet-800">
          <span className="text-lg shrink-0">🔗</span>
          <span>Ditemukan <strong>{transactions.length} transaksi</strong> milik customer ini. Centang yang ingin digabung menjadi 1 invoice.</span>
        </div>
      )}

      {/* TRX checklist */}
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Transaksi Aktif</p>
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        {transactions.map(t => {
          const isChecked = selected.has(t.transaction_id);
          const isScanned = t.transaction_id === scannedId;
          return (
            <div
              key={t.transaction_id}
              onClick={() => toggle(t.transaction_id)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                {isChecked && <svg viewBox="0 0 12 12" className="w-3 h-3"><polyline points="1.5,6 4.5,9 10.5,3" stroke="white" strokeWidth="2" fill="none"/></svg>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs font-bold text-gray-900 truncate">{t.transaction_id}</p>
                  {isScanned && <span className="text-[10px] bg-violet-100 text-violet-700 font-semibold px-1.5 py-0.5 rounded">Di-scan</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.booth_location ? `${t.booth_location} · ` : ''}
                  {(t.items ?? []).slice(0, 2).map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                  {(t.items ?? []).length > 2 ? ` +${(t.items ?? []).length - 2} lagi` : ''}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(t.created_at)}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-blue-700">{formatRupiah(t.total_amount)}</p>
                <Badge status={t.status} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total strip */}
      <div className="bg-gray-900 text-white rounded-xl px-4 py-3 flex justify-between items-center mb-4">
        <div>
          <p className="text-xs text-gray-400">{selectedTrx.length} transaksi dipilih</p>
          {booths.length > 0 && <p className="text-xs text-gray-500 mt-0.5">{booths.join(', ')}</p>}
        </div>
        <p className="text-xl font-extrabold">{formatRupiah(total)}</p>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate('/cashier')}>Batal</Button>
        <Button className="flex-1" onClick={proceed} disabled={selectedTrx.length === 0}>
          Lanjut ke Pembayaran →
        </Button>
      </div>
    </div>
  );
}
