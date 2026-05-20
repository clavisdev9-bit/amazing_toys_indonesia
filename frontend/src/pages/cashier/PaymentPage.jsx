import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lookupPayment, processPayment } from '../../api/payments';
import { formatRupiah, formatDate } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import ToastContainer from '../../components/ui/Toast';
import PrintReceiptButton from '../../components/cashier/PrintReceiptButton';
import PrintConfirmationModal from '../../components/cashier/PrintConfirmationModal';
import { sendEReceipt } from '../../services/sendEReceipt';

const METHODS = ['CASH', 'QRIS', 'EDC', 'TRANSFER'];

export default function PaymentPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const cashierName = user?.name ?? user?.username ?? 'Kasir';

  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    lookupPayment(transactionId, { signal: controller.signal })
      .then((r) => setTxn(r.data.data))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return;
        const status = err.response?.status;
        if (status === 409) {
          navigate(`/pesanan/${transactionId}/receipt`, { replace: true });
        } else if (status === 422) {
          setError('Transaksi sudah dibatalkan.');
        } else if (status === 410) {
          setError('Transaksi telah kadaluarsa.');
        } else {
          setError('Transaksi tidak ditemukan.');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [transactionId]);

  async function handleProcess(e) {
    e.preventDefault();
    setError('');
    setProcessing(true);
    try {
      const body = { transaction_id: transactionId, payment_method: method };
      if (method === 'CASH') body.cash_received = parseFloat(cashReceived);
      else body.payment_ref = paymentRef || undefined;

      const res = await processPayment(body);
      setSuccess(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Pembayaran gagal.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmPrint(sendEmail) {
    setIsModalOpen(false);
    if (sendEmail && customer?.email) {
      const result = await sendEReceipt(txn, success, customer);
      if (result.success) {
        addToast(`E-receipt sent to ${customer.email}`, 'success');
      } else {
        addToast('Failed to send e-receipt — resend manually', 'warning');
      }
    }
    addToast('Receipt printed', 'success');
  }

  const customer = txn
    ? { name: txn.customer_name, email: txn.customer_email ?? '', phone: txn.customer_phone }
    : null;

  if (loading) return <Spinner />;

  if (success) {
    return (
      <>
        <div className="max-w-lg bg-white rounded-xl border p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Pembayaran Berhasil!</h2>
          <p className="text-sm text-gray-500 mb-4">{formatDate(success.paidAt)}</p>
          <div className="bg-gray-50 rounded-lg p-4 text-left mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID Transaksi</span>
              <span className="font-mono font-bold">{success.transactionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Metode</span>
              <span className="font-semibold">{success.paymentMethod}</span>
            </div>
            {success.cashChange != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Kembalian</span>
                <span className="font-bold text-green-600">{formatRupiah(success.cashChange)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/cashier')}>
              Transaksi Baru
            </Button>
            <Button className="flex-1" onClick={() => navigate('/cashier/rekap')}>
              Lihat Rekap
            </Button>
          </div>
          <PrintReceiptButton txn={txn} onOpenModal={() => setIsModalOpen(true)} />
        </div>

        <PrintConfirmationModal
          isOpen={isModalOpen}
          txn={txn}
          success={success}
          cashierName={cashierName}
          customer={customer}
          cashReceived={method === 'CASH' && cashReceived ? parseFloat(cashReceived) : null}
          onClose={() => setIsModalOpen(false)}
          onConfirmPrint={handleConfirmPrint}
        />

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  return (
    <>
      <div className="max-w-lg">
        <button onClick={() => navigate('/cashier')} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-blue-600">
          ← Kembali
        </button>

        {error && !txn && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {txn && (
          <>
            {/* Transaction detail */}
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-mono font-bold text-gray-900">{txn.transaction_id}</p>
                  <p className="text-sm text-gray-500">{txn.customer_name} · {txn.customer_phone}</p>
                </div>
                <Badge status={txn.status} />
              </div>
              <div className="divide-y text-sm mt-3">
                {(txn.items ?? []).map((item, i) => (
                  <div key={i} className="py-1.5 flex justify-between">
                    <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                    <span className="font-medium">{formatRupiah(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              {(() => {
                const subtotal = parseFloat(txn.subtotal_amount ?? 0);
                const taxAmt   = parseFloat(txn.tax_amount ?? 0);
                const taxRate  = parseFloat(txn.tax_rate ?? 12);
                const hasTax   = taxAmt > 0;
                return (
                  <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                    {hasTax && (
                      <>
                        <div className="flex justify-between text-gray-500">
                          <span>Subtotal</span>
                          <span>{formatRupiah(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>PPN {taxRate}%</span>
                          <span>{formatRupiah(taxAmt)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-blue-700 text-lg">{formatRupiah(txn.total_amount)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Payment form */}
            <form onSubmit={handleProcess} className="bg-white rounded-xl border p-4 space-y-4">
              <h2 className="font-semibold text-gray-700">Metode Pembayaran</h2>

              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMethod(m); setCashReceived(''); setPaymentRef(''); }}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors
                      ${method === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {method === 'CASH' && (
                <div className="space-y-2">
                  <Input
                    label="Uang Diterima (Rp)"
                    type="number"
                    min={txn.total_amount}
                    step="1000"
                    placeholder={String(txn.total_amount)}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    required
                  />
                  {cashReceived && parseFloat(cashReceived) >= txn.total_amount && (
                    <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">
                      Kembalian: <strong>{formatRupiah(parseFloat(cashReceived) - txn.total_amount)}</strong>
                    </div>
                  )}
                </div>
              )}

              {method !== 'CASH' && (
                <Input
                  label="Nomor Referensi / Approval Code"
                  placeholder="Opsional"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="full"
                loading={processing}
                disabled={method === 'CASH' && (!cashReceived || parseFloat(cashReceived) < txn.total_amount)}
              >
                Proses Pembayaran
              </Button>
            </form>
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
