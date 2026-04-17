import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getOrder } from '../../api/orders';
import { formatRupiah, formatDateOnly, formatDate } from '../../utils/format';
import { groupByTenant } from '../../utils/order';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ToastContainer from '../../components/ui/Toast';
import PrintReceiptButton from '../../components/cashier/PrintReceiptButton';
import PrintConfirmationModal from '../../components/cashier/PrintConfirmationModal';
import { sendEReceipt } from '../../services/sendEReceipt';
import '../../styles/print.css';

const EVENT_NAME = 'Amazing Toys Fair 2026';
const EVENT_VENUE = 'JCC Senayan, Jakarta';

function pickupBadgeStatus(pickupStatus) {
  if (pickupStatus === 'DONE')  return 'DONE';
  if (pickupStatus === 'READY') return 'READY';
  return 'PREPARING';
}

export default function ReceiptPickupPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const { t } = useLang();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .catch((err) => {
        const msg = err.response?.data?.message;
        setError(msg ?? t('order.notFound'));
      })
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            ← {t('back')}
          </button>
        </div>
      </div>
    );
  }

  const groups = groupByTenant(order.items);
  const isStaff = role !== 'CUSTOMER';

  // Adapt order shape to what PrintConfirmationModal / sendEReceipt expect
  const txnForModal = { ...order, checkout_time: order.created_at };
  const successForModal = { paidAt: order.paid_at, paymentMethod: order.payment_method };
  const customerForModal = {
    name: order.customer_name,
    email: order.customer_email ?? '',
    phone: order.customer_phone,
  };
  const cashierName = order.cashier_name ?? user?.name ?? user?.username ?? 'Kasir';

  async function handleConfirmPrint(sendEmail) {
    setIsModalOpen(false);
    window.print();
    if (sendEmail && customerForModal.email) {
      const result = await sendEReceipt(txnForModal, successForModal, customerForModal);
      if (result.success) {
        addToast(`E-receipt sent to ${customerForModal.email}`, 'success');
      } else {
        addToast('Failed to send e-receipt — resend manually', 'warning');
      }
    }
    addToast('Receipt printed', 'success');
  }

  return (
    <>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
          >
            {t('back')}
          </button>
          {isStaff && (
            <PrintReceiptButton txn={order} onOpenModal={() => setIsModalOpen(true)} />
          )}
        </div>

        <div className="px-4 space-y-4 pb-6">

          {/* ── Payment receipt ───────────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase pt-1">
            {t('receipt.sectionReceipt')}
          </p>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-gray-800">
                  #{order.transaction_id}
                </span>
                <Badge status={order.status} />
              </div>
              <span className="text-xs text-gray-500">
                {formatDateOnly(order.paid_at ?? order.created_at)}
              </span>
            </div>
            <div className="divide-y">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <span className="text-gray-700">{item.product_name} ×{item.quantity}</span>
                  <span className="text-gray-700">{formatRupiah(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-4 py-3 border-t">
              <span className="font-bold text-gray-900 text-sm">{t('receipt.total')}</span>
              <span className="font-bold text-gray-900 text-sm">{formatRupiah(order.total_amount)}</span>
            </div>
          </div>

          {/* ── Pickup instructions ───────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase pt-1">
            {t('receipt.sectionPickup')}
          </p>

          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.tenant_id} className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <p className="text-xs font-semibold text-gray-600">
                    {group.tenant_name} · {group.booth_location}
                  </p>
                </div>
                <div className="divide-y">
                  {group.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm text-gray-800">
                        {item.product_name} ×{item.quantity}
                      </span>
                      <Badge status={pickupBadgeStatus(item.pickup_status)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── CTA — customer only ───────────────────────────────── */}
          {role === 'CUSTOMER' && (
            <button
              onClick={() => navigate(`/pesanan/${transactionId}/pickup`)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl text-base transition-colors"
            >
              {t('receipt.cta')}
            </button>
          )}

        </div>
      </div>

      {/* Print modal */}
      {isStaff && (
        <PrintConfirmationModal
          isOpen={isModalOpen}
          txn={txnForModal}
          success={successForModal}
          cashierName={cashierName}
          customer={customerForModal}
          onClose={() => setIsModalOpen(false)}
          onConfirmPrint={handleConfirmPrint}
        />
      )}

      {/* Hidden 80mm print layout */}
      {isStaff && order && (
        <div
          id="print-receipt-layout"
          className="hidden print:block"
          style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5', color: '#000', background: '#fff', padding: '12px' }}
        >
          <p style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '2px' }}>{EVENT_NAME}</p>
          <p style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>{EVENT_VENUE}</p>
          <p style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <p>ID: {order.transaction_id}</p>
          <p>Tgl: {formatDate(order.paid_at)}</p>
          <p>Kasir: {cashierName}</p>
          <p style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.product_name} × {item.quantity}</span>
              <span>{formatRupiah(item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <p style={{ borderTop: '1px solid #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
            <span>Total</span>
            <span>{formatRupiah(order.total_amount)}</span>
          </div>
          <p>Metode: {order.payment_method}</p>
          {order.cash_change != null && (
            <p>Kembalian: {formatRupiah(order.cash_change)}</p>
          )}
          <p style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>All prices include tax</p>
          <p style={{ textAlign: 'center', marginTop: '8px' }}>Terima kasih!</p>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
