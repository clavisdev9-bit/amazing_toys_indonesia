import React from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtFull(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${d.toTimeString().slice(0, 5)}`;
}

export default function PaymentToast({ notif, customerName, onDismiss }) {
  if (!notif) return null;

  return (
    <div style={{
      position:     'fixed',
      top:          12,
      left:         '50%',
      transform:    'translateX(-50%)',
      width:        'calc(100% - 24px)',
      maxWidth:     460,
      zIndex:       9999,
      background:   '#111827',
      borderRadius: 16,
      overflow:     'hidden',
      boxShadow:    '0 12px 40px rgba(0,0,0,.4)',
      animation:    'payToastIn .28s cubic-bezier(.34,1.56,.64,1)',
    }}>
      {/* Shrinking progress bar */}
      <div style={{
        height:     3,
        background: '#22c55e',
        width:      '100%',
        animation:  'payToastShrink 5s linear forwards',
      }} />

      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Pulsing icon */}
        <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
          <div style={{
            position:     'absolute', inset: 0, borderRadius: '50%',
            border:       '1.5px solid #22c55e',
            animation:    'payToastRing 1.4s ease-out infinite',
            opacity:      0.5,
          }} />
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: '#14532d33',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid #22c55e',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: '#22c55e',
            letterSpacing: '1px', marginBottom: 3,
          }}>
            PEMBAYARAN DITERIMA
          </p>
          <p style={{
            fontSize: 14, fontWeight: 700, color: '#fff',
            fontFamily: "'DM Mono', monospace", letterSpacing: '-.3px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {notif.txn}
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            {customerName ? `${customerName} · ` : ''}{fmtFull(notif.ts)}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', color: '#6b7280',
            fontSize: 20, cursor: 'pointer', padding: '0 0 0 4px',
            lineHeight: 1, flexShrink: 0,
          }}
          aria-label="Tutup notifikasi"
        >
          ×
        </button>
      </div>
    </div>
  );
}
