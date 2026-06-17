import React, { useState, useEffect } from 'react';
import { getShiftReport } from '../../api/cashier';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/ui/Spinner';

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function SectionHeader({ children }) {
  return (
    <div className="px-4 py-2.5 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide">
      {children}
    </div>
  );
}

export default function ShiftReportPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getShiftReport({ date })
      .then((r) => setReport(r.data.data))
      .finally(() => setLoading(false));
  }, [date]);

  const s = report?.summary;

  const paymentRows = s ? [
    { label: 'Tunai (CASH)',  value: s.total_cash     },
    { label: 'QRIS',         value: s.total_qris     },
    { label: 'EDC',          value: s.total_edc      },
    { label: 'Transfer',     value: s.total_transfer },
  ] : [];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; }
          body { font-size: 12px; }
        }
      `}</style>

      <div className="max-w-2xl print-page">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-xl font-bold text-gray-900">{t('shift.title')}</h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {report && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                🖨️ {t('shift.printBtn')}
              </button>
            )}
          </div>
        </div>

        {loading ? <Spinner /> : report && s && (
          <div className="space-y-4">
            {/* Print title */}
            <div className="hidden print:block text-center border-b pb-3 mb-4">
              <p className="font-bold text-xl">LAPORAN SERAH TERIMA SHIFT</p>
              <p className="text-sm">{date} — Kasir: {s.cashier_name ?? user?.name}</p>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <SectionHeader>{t('shift.summary')}</SectionHeader>
              <div className="p-4 grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{t('recap.txnCount')}</p>
                  <p className="font-bold text-gray-900 text-lg">{s.txn_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('recap.grandTotal')}</p>
                  <p className="font-bold text-blue-700 text-lg">{formatRupiah(s.grand_total ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('recap.singleTxn')}</p>
                  <p className="font-semibold">{s.txn_single_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('recap.groupTxn')}</p>
                  <p className="font-semibold text-violet-700">{s.txn_group_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('recap.voucherCount')}</p>
                  <p className="font-semibold text-green-700">{s.txn_with_voucher ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('recap.totalDiscount')}</p>
                  <p className="font-semibold text-green-700">{formatRupiah(s.total_discount ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('recap.expiredTxn')}</p>
                  <p className="font-semibold text-red-500">{s.txn_expired_count ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <SectionHeader>{t('shift.paymentBreak')}</SectionHeader>
              <div className="divide-y">
                {paymentRows.map(({ label, value }) => (
                  <div key={label} className="px-4 py-3 flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-bold text-gray-900">{formatRupiah(value ?? 0)}</span>
                  </div>
                ))}
                <div className="px-4 py-3 flex justify-between text-sm bg-blue-50">
                  <span className="font-bold text-blue-700">TOTAL</span>
                  <span className="font-bold text-blue-700">{formatRupiah(s.grand_total ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* EDC Detail */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <SectionHeader>🖨️ {t('shift.edcDetail')}</SectionHeader>
              {report.edc_log?.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">{t('shift.noEdc')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-gray-500">Waktu</th>
                      <th className="px-4 py-2 text-left text-xs text-gray-500">Customer</th>
                      <th className="px-4 py-2 text-left text-xs text-gray-500">Kode Approval</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(report.edc_log ?? []).map((row) => (
                      <tr key={row.transaction_id}>
                        <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatTime(row.paid_at)}</td>
                        <td className="px-4 py-2 text-xs truncate max-w-[120px]">{row.customer_name}</td>
                        <td className="px-4 py-2 font-mono text-xs text-amber-700">
                          {row.payment_reference || '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-bold text-blue-700">
                          {formatRupiah(row.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold text-gray-600">Total EDC</td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-blue-700">
                        {formatRupiah(s.total_edc ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Voucher Detail */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <SectionHeader>🏷️ {t('shift.voucherDetail')}</SectionHeader>
              {report.voucher_txns?.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">{t('shift.noVoucher')}</p>
              ) : (
                <div className="divide-y">
                  {(report.voucher_txns ?? []).map((txn) => (
                    <div key={txn.transaction_id} className="px-4 py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-mono text-xs text-gray-500">{txn.transaction_id.slice(0, 16)}…</p>
                        <p className="text-gray-700">{txn.customer_name}</p>
                        <p className="text-xs mt-0.5">
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                            {txn.voucher_code}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatRupiah(txn.total_amount)}</p>
                        <p className="text-xs text-green-600">-{formatRupiah(txn.discount_amount)}</p>
                        <p className="text-xs text-gray-400">{formatTime(txn.paid_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signature section for print */}
            <div className="hidden print:grid grid-cols-2 gap-8 mt-8 text-center text-sm">
              <div className="border-t pt-2 mt-12">
                <p>Kasir</p>
                <p className="text-xs text-gray-500">({s.cashier_name ?? user?.name})</p>
              </div>
              <div className="border-t pt-2 mt-12">
                <p>Leader / Supervisor</p>
                <p className="text-xs text-gray-500">(………………………………)</p>
              </div>
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-400 text-center pb-2 no-print">
              {t('shift.generatedAt')}: {formatDateTime(report.generated_at)}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
