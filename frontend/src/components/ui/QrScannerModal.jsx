import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const TXN_PATTERN = /TXN-\d{8}-\d{5}/i;

function parseTxnFromQr(raw) {
  const text = (raw || '').trim();
  try {
    const obj = JSON.parse(text);
    const candidate =
      obj.transaction_no || obj.transactionId || obj.transaction_id ||
      Object.values(obj).find((v) => typeof v === 'string' && TXN_PATTERN.test(v));
    if (candidate) {
      const m = String(candidate).match(TXN_PATTERN);
      if (m) return m[0].toUpperCase();
    }
  } catch { /* not JSON */ }
  const m = text.match(TXN_PATTERN);
  return m ? m[0].toUpperCase() : null;
}

export default function QrScannerModal({
  onResult,
  onClose,
  title = 'Scan QR Transaksi',
  hint = 'Arahkan kamera ke QR code pada struk pelanggan',
  resultParser = parseTxnFromQr,
}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [error, setError]     = useState(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;

    async function start() {
      // Guard: getUserMedia requires a secure context (HTTPS or localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera membutuhkan koneksi HTTPS. Buka: https://' + window.location.host + window.location.pathname);
        setStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        if (!active) return;

        setStarting(false);
        scanLoop();
      } catch (err) {
        if (!active) return;
        const name = err?.name || '';
        let friendly;
        if (name === 'NotAllowedError')  friendly = 'Akses kamera ditolak. Izinkan kamera di pengaturan browser.';
        else if (name === 'NotFoundError')   friendly = 'Tidak ada kamera yang tersedia di perangkat ini.';
        else if (name === 'NotReadableError') friendly = 'Kamera sedang digunakan aplikasi lain. Tutup lalu coba lagi.';
        else friendly = `Kamera tidak dapat dibuka (${name || err?.message || 'unknown'}).`;
        setError(friendly);
        setStarting(false);
      }
    }

    function scanLoop() {
      if (!active) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }
      const w = video.videoWidth, h = video.videoHeight;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (code) {
        const parsed = resultParser(code.data);
        if (parsed) { onResult(parsed); return; }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    start();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-0 sm:mx-4 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">✕</button>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ minHeight: 300 }}>
          <canvas ref={canvasRef} className="hidden" />
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full block"
            style={{ display: error ? 'none' : 'block', maxHeight: 360 }}
          />

          {/* Scan guide */}
          {!starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                {/* Corner brackets */}
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
              </div>
            </div>
          )}

          {/* Loading */}
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="flex flex-col items-center gap-2 text-white text-sm">
                <svg className="animate-spin w-7 h-7" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Membuka kamera...
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center justify-center bg-gray-900 p-6" style={{ minHeight: 300 }}>
              <div className="text-center text-white">
                <div className="text-4xl mb-3">📷</div>
                <p className="text-sm leading-relaxed">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!error
          ? <p className="text-xs text-center text-gray-500 px-4 py-3">{hint}</p>
          : <div className="p-4"><button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200">Tutup</button></div>
        }
      </div>
    </div>
  );
}
