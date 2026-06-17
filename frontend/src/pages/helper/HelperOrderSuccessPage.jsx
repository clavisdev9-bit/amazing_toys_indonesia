import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatRupiah } from '../../utils/format';
import { resendWa }     from '../../api/helper';
import Button           from '../../components/ui/Button';

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdownTo(expiresAt) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const diff = Math.max(0, new Date(expiresAt) - Date.now());
      setRemaining(diff);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const totalSecs = Math.floor(remaining / 1000);
  const hours     = Math.floor(totalSecs / 3600);
  const mins      = Math.floor((totalSecs % 3600) / 60);
  const secs      = totalSecs % 60;
  return { remaining, hours, mins, secs };
}

// ── Layer status chip ─────────────────────────────────────────────────────────
function LayerChip({ icon, label, status, sub }) {
  const colors = {
    ok:      'bg-green-50 border-green-200 text-green-700',
    pending: 'bg-amber-50  border-amber-200  text-amber-700',
    error:   'bg-red-50    border-red-200    text-red-700',
    info:    'bg-blue-50   border-blue-200   text-blue-700',
    skip:    'bg-gray-50   border-gray-200   text-gray-500',
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${colors[status] || colors.info}`}>
      <span className="text-base leading-5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {sub && <p className="text-xs opacity-75 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── QR value for qrcode.react ─────────────────────────────────────────────────
// Backend returns qrPayload as base64 PNG; qrcode.react needs the raw TXN-ID string.
// We encode the TXN-ID directly since that's what the cashier scanner reads.
function QrDisplay({ transactionId, size = 220 }) {
  return (
    <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
      <QRCodeSVG
        value={transactionId}
        size={size}
        level="M"
        includeMargin={false}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function HelperOrderSuccessPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const orderData = location.state;   // passed via navigate('/helper/order-success', { state: data })

  const [resending, setResending]   = useState(false);
  const [resendPhone, setResendPhone] = useState('');
  const [resendResult, setResendResult] = useState(null); // { status, waSentTo }
  const [showResendInput, setShowResendInput] = useState(false);

  const { remaining, hours, mins, secs } = useCountdownTo(orderData?.expiresAt);

  // Jika halaman dibuka langsung (tanpa state), redirect ke /helper
  useEffect(() => {
    if (!orderData?.transactionId) navigate('/helper', { replace: true });
  }, [orderData, navigate]);

  const handleResend = useCallback(async () => {
    setResending(true);
    setResendResult(null);
    try {
      const phone = resendPhone.trim() || null;
      const res   = await resendWa(orderData.transactionId, phone);
      setResendResult(res.data.data);
      setShowResendInput(false);
      setResendPhone('');
    } catch (err) {
      setResendResult({
        waDeliveryStatus: 'FAILED',
        error: err.response?.data?.message || 'Gagal mengirim WA.',
      });
    } finally {
      setResending(false);
    }
  }, [orderData?.transactionId, resendPhone]);

  if (!orderData?.transactionId) return null;

  const {
    transactionId,
    totalAmount,
    waSentTo,
    waDeliveryStatus: initialWaStatus,
    publicLink,
    items = [],
  } = orderData;

  const effectiveWaStatus = resendResult?.waDeliveryStatus || initialWaStatus;

  // Derive Layer 1 chip state
  let waChipStatus = 'pending';
  let waChipLabel  = 'Mengirim WA...';
  let waChipSub    = waSentTo ? `ke ${waSentTo}` : null;

  if (!waSentTo && effectiveWaStatus === 'SKIPPED') {
    waChipStatus = 'skip';
    waChipLabel  = 'WA tidak dikirim';
    waChipSub    = 'Tidak ada nomor HP';
  } else if (effectiveWaStatus === 'SENT') {
    waChipStatus = 'ok';
    waChipLabel  = `WA terkirim ke ${resendResult?.waSentTo || waSentTo}`;
    waChipSub    = null;
  } else if (effectiveWaStatus === 'FAILED') {
    waChipStatus = 'error';
    waChipLabel  = 'Pengiriman WA gagal';
    waChipSub    = resendResult?.error || 'Gateway error';
  }

  const expired = remaining === 0 && orderData.expiresAt;

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/helper')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-4 transition-colors"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Helper
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">✓</div>
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Order Berhasil Dibuat</h1>
          <p className="font-mono text-sm text-gray-500">{transactionId}</p>
        </div>
      </div>

      {/* QR Code card */}
      <div className="bg-white rounded-2xl border p-5 mb-4 text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          QR untuk Pembayaran Kasir
        </p>

        <div className="flex justify-center mb-4">
          <QrDisplay transactionId={transactionId} size={220} />
        </div>

        <p className="font-mono font-bold text-gray-800 mb-1">{transactionId}</p>
        <p className="text-xl font-extrabold text-blue-700 mb-3">{formatRupiah(totalAmount)}</p>

        {/* Countdown */}
        {orderData.expiresAt && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
            expired ? 'bg-red-100 text-red-700' :
            (hours === 0 && mins < 10) ? 'bg-amber-100 text-amber-700' :
            'bg-green-100 text-green-700'
          }`}>
            <span>⏱</span>
            {expired
              ? 'QR Kedaluwarsa'
              : `${hours > 0 ? `${hours}j ` : ''}${mins}m ${String(secs).padStart(2, '0')}d`}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Minta customer tunjukkan QR ini ke kasir untuk pembayaran
        </p>
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border divide-y mb-4">
          {items.map(item => (
            <div key={item.product_id} className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-gray-700">{item.product_name} ×{item.qty}</span>
              <span className="text-gray-500">{formatRupiah(item.unit_price * item.qty)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-2.5 font-semibold text-sm">
            <span>Total</span>
            <span className="text-blue-700">{formatRupiah(totalAmount)}</span>
          </div>
        </div>
      )}

      {/* Delivery status chips */}
      <div className="space-y-2 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status Notifikasi</p>

        {/* WhatsApp */}
        {waChipStatus !== 'pending' && (
          <LayerChip
            icon={waChipStatus === 'ok' ? '✅' : waChipStatus === 'error' ? '❌' : '➖'}
            label={waChipLabel}
            sub={waChipSub}
            status={waChipStatus}
          />
        )}

        {/* Push notification (hanya tampil jika ada customerId) */}
        {orderData.customerId && (
          <LayerChip
            icon="📡"
            label="Notifikasi dikirim ke customer"
            sub="Customer akan menerima notifikasi jika online"
            status="info"
          />
        )}

        {/* QR selalu tersedia */}
        <LayerChip
          icon="📱"
          label="QR tersedia di layar ini"
          sub="Tunjukkan ke kasir jika customer belum terima WA"
          status="ok"
        />
      </div>

      {/* Public link */}
      {publicLink && (
        <div className="bg-gray-50 rounded-lg border px-3 py-2 mb-4">
          <p className="text-xs text-gray-400 mb-1">Link publik customer:</p>
          <p className="text-xs font-mono text-blue-600 break-all">{publicLink}</p>
        </div>
      )}

      {/* Resend WA button */}
      <div className="space-y-2 mb-4">
        {showResendInput ? (
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="08xxx (opsional — pakai nomor baru)"
              value={resendPhone}
              onChange={e => setResendPhone(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleResend} loading={resending} className="shrink-0">
              Kirim
            </Button>
            <button
              onClick={() => { setShowResendInput(false); setResendPhone(''); }}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResendInput(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            <span>📤</span> Kirim Ulang WA
          </button>
        )}

        {resendResult && (
          <p className={`text-xs text-center ${resendResult.waDeliveryStatus === 'SENT' ? 'text-green-600' : 'text-red-600'}`}>
            {resendResult.waDeliveryStatus === 'SENT'
              ? `✓ WA dikirim ulang ke ${resendResult.waSentTo}`
              : `✗ Gagal: ${resendResult.error || 'Error tidak diketahui'}`}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate('/helper')}
          className="flex-1"
          variant="secondary"
        >
          ← Kembali
        </Button>
        <Button
          onClick={() => navigate('/helper')}
          className="flex-1"
          variant="primary"
        >
          Buat Order Berikutnya
        </Button>
      </div>
    </div>
  );
}
