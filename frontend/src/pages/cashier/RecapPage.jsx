import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getRecap, getTransactions } from '../../api/cashier';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function RecapPage() {
  const { t } = useLang();
  const [date, setDate] = useState(today());
  const [recap, setRecap] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getRecap({ date }),
      getTransactions({ date }),
    ]).then(([r1, r2]) => {
      setRecap(r1.data.data);
      setTransactions(r2.data.data?.items ?? r2.data.data ?? []);
    }).finally(() => setLoading(false));
  }, [date]);

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    if (!recap) return;

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Ringkasan ────────────────────────────────────────────────
    const summaryRows = [
      ['REKAP HARIAN KASIR'],
      ['Tanggal', date],
      ['Kasir', recap.cashier_name ?? '—'],
      [],
      ['RINGKASAN PEMBAYARAN'],
      ['Jumlah Transaksi', recap.txn_count ?? 0],
      ['Total Keseluruhan', recap.grand_total ?? 0],
      ['Cash', recap.total_cash ?? 0],
      ['QRIS', recap.total_qris ?? 0],
      ['EDC', recap.total_edc ?? 0],
      ['Transfer', recap.total_transfer ?? 0],
      [],
      ['JENIS TRANSAKSI'],
      ['Transaksi Tunggal', recap.txn_single_count ?? 0],
      ['Transaksi Grup', recap.txn_group_count ?? 0],
      ['Kadaluarsa', recap.txn_expired_count ?? 0],
      [],
      ['VOUCHER'],
      ['Transaksi Pakai Voucher', recap.txn_with_voucher ?? 0],
      ['Total Diskon', recap.total_discount ?? 0],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

    // ── Sheet 2: Transaksi ────────────────────────────────────────────────
    const txnHeaders = [
      'No', 'Transaction ID', 'Waktu', 'Customer', 'Kasir',
      'Metode Bayar', 'Referensi EDC', 'Voucher', 'Diskon (Rp)',
      'Total (Rp)', 'Tipe',
    ];
    const txnRows = transactions.map((txn, idx) => [
      idx + 1,
      txn.transaction_id,
      txn.paid_at ? new Date(txn.paid_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }) : '—',
      txn.customer_name ?? '—',
      txn.cashier_name  ?? '—',
      txn.payment_method ?? '—',
      txn.payment_method === 'EDC' ? (txn.payment_reference ?? '') : '',
      txn.voucher_code  ?? '',
      parseFloat(txn.discount_amount ?? 0),
      parseFloat(txn.total_amount ?? 0),
      txn.group_id ? 'Grup' : 'Tunggal',
    ]);
    const wsTransactions = XLSX.utils.aoa_to_sheet([txnHeaders, ...txnRows]);
    wsTransactions['!cols'] = [
      { wch: 4 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 18 },
      { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
    ];
    // Freeze header row
    wsTransactions['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transaksi');

    XLSX.writeFile(wb, `rekap-kasir-${date}.xlsx`);
  }

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body > *:not(#recap-print-root) { display: none !important; }
          #recap-print-root { display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="recap-print-root" className="max-w-2xl" ref={printRef}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-xl font-bold text-gray-900">{t('recap.title')}</h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {recap && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-medium text-white transition-colors"
                >
                  📥 Export Excel
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
                >
                  🖨️ {t('recap.printBtn')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Print header (visible only on print) */}
        <div className="hidden print:block mb-4 text-center">
          <p className="font-bold text-lg">REKAP HARIAN KASIR</p>
          <p className="text-sm text-gray-600">{date}</p>
          {recap?.cashier_name && <p className="text-sm">Kasir: {recap.cashier_name}</p>}
        </div>

        {loading ? <Spinner /> : recap && (
          <>
            {/* ── Payment Breakdown ── */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: t('recap.txnCount'),   value: recap.txn_count,      format: (v) => v },
                { label: t('recap.grandTotal'), value: recap.grand_total,    format: formatRupiah, big: true },
                { label: t('recap.cash'),       value: recap.total_cash,     format: formatRupiah },
                { label: t('recap.qris'),       value: recap.total_qris,     format: formatRupiah },
                { label: t('recap.edc'),        value: recap.total_edc,      format: formatRupiah },
                { label: t('recap.transfer'),   value: recap.total_transfer, format: formatRupiah },
              ].map((card) => (
                <div key={card.label} className={`bg-white rounded-xl border p-4 ${card.big ? 'col-span-2' : ''}`}>
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className={`font-bold text-gray-900 ${card.big ? 'text-2xl text-blue-700' : 'text-lg'}`}>
                    {card.format(card.value ?? 0)}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Transaction Type Split ── */}
            <div className="bg-white rounded-xl border p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {t('recap.splitSection')}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{recap.txn_single_count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('recap.singleTxn')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-violet-700">{recap.txn_group_count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('recap.groupTxn')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{recap.txn_expired_count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('recap.expiredTxn')}</p>
                </div>
              </div>
            </div>

            {/* ── Voucher Summary ── */}
            {(recap.txn_with_voucher > 0 || recap.total_discount > 0) && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">
                  🏷️ {t('recap.voucherSection')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-green-600 mb-0.5">{t('recap.voucherCount')}</p>
                    <p className="text-xl font-bold text-green-800">{recap.txn_with_voucher ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600 mb-0.5">{t('recap.totalDiscount')}</p>
                    <p className="text-xl font-bold text-green-800">{formatRupiah(recap.total_discount ?? 0)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Transaction List ── */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">
                  {t('recap.txnList', { count: transactions.length })}
                </div>
                <div className="divide-y overflow-auto max-h-96">
                  {transactions.map((txn) => (
                    <div key={txn.transaction_id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-semibold text-gray-900">{txn.transaction_id}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {txn.customer_name}
                            {txn.group_id && (
                              <span className="ml-1.5 bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                GROUP
                              </span>
                            )}
                            {txn.voucher_code && (
                              <span className="ml-1.5 bg-green-100 text-green-700 text-[10px] font-medium px-1.5 py-0.5 rounded">
                                🏷️ {txn.voucher_code}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-700">{formatRupiah(txn.total_amount)}</p>
                          <p className="text-xs text-gray-400">{txn.payment_method} · {formatTime(txn.paid_at)}</p>
                        </div>
                      </div>
                      {/* EDC reference */}
                      {txn.payment_method === 'EDC' && txn.payment_reference && (
                        <p className="mt-1 text-[11px] text-amber-700 font-mono bg-amber-50 rounded px-2 py-0.5 inline-block">
                          {t('recap.edcRef')}: {txn.payment_reference}
                        </p>
                      )}
                      {/* Discount info */}
                      {txn.discount_amount > 0 && (
                        <p className="mt-0.5 text-[11px] text-green-600">
                          Diskon: -{formatRupiah(txn.discount_amount)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
