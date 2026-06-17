import React, { useState, useEffect } from 'react';
import { getEdcLog } from '../../api/cashier';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Spinner from '../../components/ui/Spinner';

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function EDCLogPage() {
  const { t } = useLang();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getEdcLog({ date })
      .then((r) => setRows(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, [date]);

  const edcTotal = rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-xl font-bold text-gray-900">{t('edcLog.title')}</h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {rows.length > 0 && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors no-print"
              >
                🖨️ Print
              </button>
            )}
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4 text-center">
          <p className="font-bold text-lg">LOG TRANSAKSI EDC</p>
          <p className="text-sm text-gray-600">{date}</p>
        </div>

        {loading ? <Spinner /> : (
          <>
            {rows.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
                {t('edcLog.empty')}
              </div>
            ) : (
              <>
                {/* Summary card */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-amber-600 mb-0.5">{t('edcLog.total')}</p>
                    <p className="text-2xl font-bold text-amber-800">{formatRupiah(edcTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-600 mb-0.5">{t('recap.txnCount')}</p>
                    <p className="text-2xl font-bold text-amber-800">{rows.length}</p>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Waktu</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('edcLog.approvalCode')}</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((row) => (
                        <tr key={row.transaction_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {formatTime(row.paid_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 truncate max-w-[140px]">{row.customer_name}</p>
                            <p className="text-[11px] font-mono text-gray-400 truncate max-w-[140px]">
                              {row.group_code ? (
                                <span className="text-violet-600 font-semibold">{row.group_code}</span>
                              ) : (
                                row.transaction_id.slice(0, 8) + '…'
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {row.payment_reference ? (
                              <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[12px]">
                                {row.payment_reference}
                              </span>
                            ) : (
                              <span className="text-gray-300">{t('edcLog.noRef')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">
                            {formatRupiah(row.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-gray-700">{t('edcLog.total')}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-blue-700">{formatRupiah(edcTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
