import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { getTransactions, getExpiredTransactions, getCustomerActiveTrx, listGroups, getGroupDetail } from '../../api/cashier';
import { lookupPayment } from '../../api/payments';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PrintGroupReceiptButton from '../../components/cashier/PrintGroupReceiptButton';

function buildBoothBreakdown(groupDetail) {
  const map = {};
  (groupDetail.transactions ?? []).forEach(txn => {
    (txn.items ?? []).forEach(item => {
      const key = item.tenant_name
        ? `${item.tenant_name} – ${item.booth_location || 'Booth'}`
        : (item.booth_location || 'Booth');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
  });
  return map;
}

export default function CashierDashboardPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [txnId, setTxnId]             = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [looking, setLooking]         = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [recent, setRecent]           = useState([]);
  const [queue, setQueue]             = useState([]);
  const [expired, setExpired]         = useState([]);
  const [groups, setGroups]           = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null); // { code, loading, detail }
  const [activeTab, setActiveTab]     = useState('queue');

  const loadQueue = useCallback(() => {
    client.get('/cashier/queue')
      .then(r => setQueue(r.data.data || []))
      .catch(() => {});
  }, []);

  const loadExpired = useCallback(() => {
    getExpiredTransactions()
      .then(r => setExpired(r.data.data || []))
      .catch(() => {});
  }, []);

  const loadGroups = useCallback(() => {
    listGroups()
      .then(r => setGroups(r.data.data || []))
      .catch(() => {});
  }, []);

  async function handleGroupExpand(group) {
    if (expandedGroup?.code === group.group_code) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup({ code: group.group_code, loading: true, detail: null });
    try {
      const res = await getGroupDetail(group.group_code);
      setExpandedGroup({ code: group.group_code, loading: false, detail: res.data.data });
    } catch {
      setExpandedGroup({ code: group.group_code, loading: false, detail: null });
    }
  }

  useEffect(() => {
    loadQueue();
    loadExpired();
    getTransactions().then((r) => {
      const items = r.data.data?.items ?? r.data.data ?? [];
      setRecent(items);
    }).catch(() => {});
  }, [loadQueue, loadExpired]);

  async function handleLookup(e) {
    e.preventDefault();
    if (!txnId.trim()) return;
    setLookupError('');
    setLooking(true);
    try {
      const txnRes = await lookupPayment(txnId.trim());
      const txnData = txnRes.data.data;

      // Check for other active TRX from the same customer
      const phone = txnData?.customer_phone ?? txnData?.walk_in_phone ?? null;
      if (phone) {
        const activeRes = await getCustomerActiveTrx({ phone }).catch(() => null);
        const activeTrx = activeRes?.data?.data ?? [];
        if (activeTrx.length > 1) {
          // Multiple TRX found — go to merge page
          navigate('/cashier/group-merge', {
            state: { transactions: activeTrx, scannedId: txnId.trim() },
          });
          return;
        }
      }

      // Single TRX — go directly to payment page (existing flow)
      const code = voucherCode.trim().toUpperCase() || undefined;
      navigate(`/cashier/bayar/${txnId.trim()}`, { state: code ? { preVoucher: code } : undefined });
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message;
      if (status === 409) setLookupError(t('cashier.err409'));
      else if (status === 410) setLookupError(t('cashier.err410'));
      else if (status === 404) setLookupError(t('cashier.err404'));
      else setLookupError(msg ?? t('cashier.errDefault'));
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">{t('cashier.title')}</h1>

      {/* POS Langsung shortcut */}
      <button
        onClick={() => navigate('/cashier/pos')}
        className="w-full flex items-center gap-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-4 mb-6 transition-colors shadow-sm text-left"
      >
        <span className="text-3xl">🛒</span>
        <div>
          <p className="font-bold text-base">{t('cashier.posTitle')}</p>
          <p className="text-blue-200 text-xs mt-0.5">{t('cashier.posDesc')}</p>
        </div>
        <span className="ml-auto text-blue-200 text-xl">→</span>
      </button>

      {/* Lookup form — always visible */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">{t('cashier.search')}</h2>
        <form onSubmit={handleLookup} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="TXN-20260415-00001"
                value={txnId}
                onChange={(e) => { setTxnId(e.target.value.toUpperCase()); setLookupError(''); }}
                className="font-mono"
                error={lookupError}
              />
            </div>
            <Button type="submit" loading={looking} className="shrink-0">
              {t('cashier.searchBtn')}
            </Button>
          </div>

          {/* Optional voucher code — auto-applied on the payment page */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-base shrink-0">🏷️</span>
            <input
              type="text"
              placeholder={t('cashier.voucherPlaceholder')}
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              className="flex-1 text-sm font-mono bg-transparent focus:outline-none text-amber-900 placeholder:text-amber-400 uppercase tracking-wider"
              maxLength={50}
            />
            {voucherCode && (
              <button
                type="button"
                onClick={() => setVoucherCode('')}
                className="text-amber-400 hover:text-amber-700 text-xs shrink-0"
              >✕</button>
            )}
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'queue' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          {t('cashier.queueTab')} ({queue.length})
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recent' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          {t('cashier.processedTab')}
        </button>
        <button
          onClick={() => { setActiveTab('expired'); loadExpired(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'expired' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
          }`}
        >
          Kadaluarsa {expired.length > 0 && <span className="ml-1 bg-red-100 text-red-600 text-xs rounded-full px-1.5 py-0.5">{expired.length}</span>}
        </button>
        <button
          onClick={() => { setActiveTab('groups'); loadGroups(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'groups' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500'
          }`}
        >
          Group Invoice {groups.length > 0 && <span className="ml-1 bg-violet-100 text-violet-700 text-xs rounded-full px-1.5 py-0.5">{groups.length}</span>}
        </button>
      </div>

      {/* Queue tab — RESERVED + WAITING_PAYMENT + PENDING orders */}
      {activeTab === 'queue' && (
        <div>
          <div className="flex justify-end mb-2">
            <button onClick={loadQueue} className="text-xs text-blue-600 hover:underline">{t('helper.refresh')}</button>
          </div>
          {queue.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('cashier.noQueue')}</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {queue.map(txn => (
                <button
                  key={txn.transaction_id}
                  onClick={() => navigate(`/cashier/bayar/${txn.transaction_id}`)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900">{txn.transaction_id}</p>
                    <p className="text-xs text-gray-500">
                      {txn.booth_location ? `${txn.booth_location} · ` : ''}
                      {txn.customer_name || txn.customer_phone || txn.walk_in_phone || 'Walk-in'} ·{' '}
                      {formatDate(txn.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-700">{formatRupiah(txn.total_amount)}</p>
                    <Badge status={txn.status} label={t(`badge.${txn.status}`)} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent tab — PAID transactions today */}
      {activeTab === 'recent' && (
        <div>
          {recent.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('cashier.noTransactions')}</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {recent.map((txn) => (
                <button
                  key={txn.transaction_id}
                  onClick={() => navigate(`/cashier/bayar/${txn.transaction_id}`)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900">{txn.transaction_id}</p>
                    <p className="text-xs text-gray-400">{txn.customer_name} · {txn.paid_at ? formatDate(txn.paid_at) : '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-700">{formatRupiah(txn.total_amount)}</p>
                    <Badge status={txn.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expired tab — EXPIRED transactions today */}
      {activeTab === 'expired' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-400">Transaksi yang melewati batas waktu tanpa pembayaran.</p>
            <button onClick={loadExpired} className="text-xs text-red-500 hover:underline">{t('helper.refresh')}</button>
          </div>
          {expired.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Tidak ada transaksi kadaluarsa hari ini.</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {expired.map((txn) => (
                <div
                  key={txn.transaction_id}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 opacity-70"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-700">{txn.transaction_id}</p>
                    <p className="text-xs text-gray-500">
                      {txn.booth_location ? `${txn.booth_location} · ` : ''}
                      {txn.customer_name || txn.customer_phone || txn.walk_in_phone || 'Walk-in'} ·{' '}
                      Dibuat {formatDate(txn.created_at)}
                    </p>
                    <p className="text-xs text-red-400 mt-0.5">Kadaluarsa: {formatDate(txn.expires_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-500">{formatRupiah(txn.total_amount)}</p>
                    <Badge status="EXPIRED" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Group Invoice tab */}
      {activeTab === 'groups' && (
        <div>
          <div className="flex justify-end mb-2">
            <button onClick={loadGroups} className="text-xs text-violet-600 hover:underline">{t('helper.refresh')}</button>
          </div>
          {groups.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Belum ada group invoice hari ini.</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {groups.map(grp => {
                const isOpen = expandedGroup?.code === grp.group_code;
                return (
                  <div key={grp.group_id}>
                    {/* Row header — clickable */}
                    <button
                      onClick={() => handleGroupExpand(grp)}
                      className="w-full px-4 py-3 text-left hover:bg-violet-50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-violet-700">{grp.group_code}</span>
                          <span className="text-xs text-gray-400 font-normal">
                            {grp.transaction_count} TRX · {grp.payment_method}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {grp.customer_name || grp.customer_phone || 'Walk-in'}{grp.customer_phone && grp.customer_name ? ` · ${grp.customer_phone}` : ''} · {formatDate(grp.created_at)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-sm font-bold text-blue-700">{formatRupiah(grp.total_amount)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">PAID</span>
                      </div>
                      <span className="text-gray-400 text-sm ml-1">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {/* Expanded detail panel */}
                    {isOpen && (
                      <div className="bg-violet-50 border-t border-violet-100 px-4 py-3">
                        {expandedGroup.loading ? (
                          <p className="text-xs text-gray-400 py-2">Memuat detail…</p>
                        ) : expandedGroup.detail ? (
                          <>
                            {/* Transaction list */}
                            <div className="space-y-1.5 mb-3">
                              {expandedGroup.detail.transactions.map(txn => (
                                <div key={txn.transaction_id} className="flex justify-between items-center text-xs">
                                  <span className="font-mono text-gray-700">{txn.transaction_id}</span>
                                  <span className="text-gray-500 mx-2 truncate">
                                    {(txn.items?.[0]?.tenant_name) || ''}
                                    {(txn.items?.[0]?.booth_location) ? ` · ${txn.items[0].booth_location}` : ''}
                                  </span>
                                  <span className="font-semibold text-gray-800 shrink-0">{formatRupiah(txn.total_amount)}</span>
                                </div>
                              ))}
                            </div>
                            {/* Print receipt button */}
                            <div className="flex justify-end">
                              <PrintGroupReceiptButton
                                groupCode={grp.group_code}
                                customer={{ name: grp.customer_name, phone: grp.customer_phone }}
                                boothBreakdown={buildBoothBreakdown(expandedGroup.detail)}
                                totalAmount={grp.total_amount}
                                cashReceived={null}
                                cashChange={null}
                                paymentMethod={grp.payment_method}
                                cashierName={grp.cashier_name || ''}
                                paidAt={grp.created_at}
                                transactionIds={expandedGroup.detail.transactions.map(t => t.transaction_id)}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-red-400 py-2">Gagal memuat detail group.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
