import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useLang } from '../../context/LangContext';

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

/**
 * Cross-browser getUserMedia helper.
 * Tries navigator.mediaDevices.getUserMedia first (modern),
 * then falls back to the vendor-prefixed callback API (old Android / Firefox).
 */
function getMediaStream(constraints) {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  const legacyGUM =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;
  if (legacyGUM) {
    return new Promise((resolve, reject) =>
      legacyGUM.call(navigator, constraints, resolve, reject),
    );
  }
  return Promise.reject(Object.assign(new Error('NotSupportedError'), { name: 'NotSupportedError' }));
}

export default function QrScannerModal({
  onResult,
  onClose,
  title,
  hint,
  resultParser = parseTxnFromQr,
}) {
  const { t } = useLang();
  const resolvedTitle = title ?? t('qrScanner.defaultTitle');
  const resolvedHint  = hint  ?? t('qrScanner.defaultHint');

  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);
  const frozenRef       = useRef(null);
  const streamRef       = useRef(null);
  const rafRef          = useRef(null);
  const onResultRef     = useRef(onResult);
  const resultParserRef = useRef(resultParser);
  const [error, setError]       = useState(null);
  const [starting, setStarting] = useState(true);
  const [frozen, setFrozen]     = useState(false);

  // Keep refs pointing at the latest callbacks without restarting the camera effect
  useLayoutEffect(() => {
    onResultRef.current     = onResult;
    resultParserRef.current = resultParser;
  });

  useEffect(() => {
    let active     = true;
    let frameCount = 0;

    async function start() {
      // Constraint cascade: try ideal → bare facingMode → any video
      // This handles OverconstrainedError on old cameras that reject resolution hints.
      const constraintSets = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false },
      ];

      let stream  = null;
      let lastErr = null;
      for (const c of constraintSets) {
        try {
          stream = await getMediaStream(c);
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!stream) {
        if (!active) return;
        const name = lastErr?.name || '';
        let friendly;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
          friendly = t('qrScanner.errDenied');
        else if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
          friendly = t('qrScanner.errNotFound');
        else if (name === 'NotReadableError' || name === 'TrackStartError')
          friendly = t('qrScanner.errBusy');
        else if (name === 'NotSupportedError')
          friendly = 'Kamera membutuhkan koneksi HTTPS. Buka: https://' + window.location.host + window.location.pathname;
        else
          friendly = `Kamera tidak dapat dibuka (${name || lastErr?.message || 'unknown'}).`;
        setError(friendly);
        setStarting(false);
        return;
      }

      if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      const video = videoRef.current;

      // srcObject fallback — iOS Safari < 11 does not support srcObject
      if ('srcObject' in video) {
        video.srcObject = stream;
      } else {
        // eslint-disable-next-line no-param-reassign
        video.src = URL.createObjectURL(stream);
      }

      video.setAttribute('playsinline', 'true');
      // Explicit muted attribute required for autoplay on some old Android Chrome
      video.setAttribute('muted', '');
      video.muted = true;

      // play() may return undefined on pre-2017 browsers — guard before await
      try {
        const maybePromise = video.play();
        if (maybePromise !== undefined) await maybePromise;
      } catch (err) {
        if (!active) return;
        setError(t('qrScanner.errPlay'));
        setStarting(false);
        return;
      }

      if (!active) return;
      setStarting(false);
      scanLoop();
    }

    function scanLoop() {
      if (!active) return;
      frameCount++;

      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 4 /* HAVE_ENOUGH_DATA */) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      // Old Android Chrome sometimes reports 0×0 even at HAVE_ENOUGH_DATA —
      // wait until the decoder delivers real dimensions.
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      // Process every 3rd frame (~20 fps) — reduces CPU on low-end devices
      if (frameCount % 3 !== 0) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      canvas.width  = w;
      canvas.height = h;
      // willReadFrequently is a perf hint; ignored by old browsers — safe to pass
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) ?? canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      ctx.drawImage(video, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });

      if (code) {
        const parsed = resultParserRef.current(code.data);
        if (parsed) {
          // Copy current frame to the visible frozen canvas
          const fc = frozenRef.current;
          if (fc) {
            fc.width  = w;
            fc.height = h;
            const fctx = fc.getContext('2d');
            if (fctx) fctx.drawImage(video, 0, 0, w, h);
          }
          // Stop live camera feed
          active = false;
          cancelAnimationFrame(rafRef.current);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          setFrozen(true);
          // Deliver result after brief pause so user sees the lock
          setTimeout(() => onResultRef.current(parsed), 900);
          return;
        }
      }

      rafRef.current = requestAnimationFrame(scanLoop);
    }

    start();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // empty deps — camera starts once on mount; callbacks stay current via refs above

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-0 sm:mx-4 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">{resolvedTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">✕</button>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ minHeight: 300 }}>
          {/* Hidden working canvas for jsQR processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Frozen frame canvas — shown after capture */}
          <canvas
            ref={frozenRef}
            className="w-full block"
            style={{ display: frozen ? 'block' : 'none', maxHeight: 360 }}
          />

          {/* Live video feed */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full block"
            style={{ display: (!error && !frozen) ? 'block' : 'none', maxHeight: 360 }}
          />

          {/* Scan guide — shown while scanning */}
          {!starting && !error && !frozen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
              </div>
            </div>
          )}

          {/* Success overlay — shown when frame is locked */}
          {frozen && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                  <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white text-sm font-semibold drop-shadow">{t('qrScanner.detected')}</span>
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
                {t('qrScanner.opening')}
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
        {!error && !frozen && (
          <p className="text-xs text-center text-gray-500 px-4 py-3">{resolvedHint}</p>
        )}
        {!error && frozen && (
          <p className="text-xs text-center text-green-600 font-medium px-4 py-3">{t('qrScanner.processing')}</p>
        )}
        {error && (
          <div className="p-4">
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200">
              {t('qrScanner.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
