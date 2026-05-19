import React from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtFull(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${d.toTimeString().slice(0, 5)}`;
}

/**
 * Bottom-sheet notification panel.
 *
 * Props:
 *   notifs      – array from usePaymentNotifications
 *   groups      – grouped orders array (for customer-name lookup by transaction_id)
 *   onClose     – close handler
 *   onMarkRead  – (id) => void
 *   onMarkAll   – () => void
 */
export default function PaymentNotifSheet({ notifs, groups, onClose, onMarkRead, onMarkAll }) {
  const unread = notifs.filter(n => !n.read).length;

  function customerFor(notif) {
    const g = groups?.find(o => o.transaction_id === notif.txn);
    return g?.customer_name || null;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex', flexDirection: 'column' }}>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{ flex: 1, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)' }}
      />

      {/* Sheet */}
      <div style={{
        background:    '#fff',
        borderRadius:  '20px 20px 0 0',
        animation:     'paySheetUp .3s cubic-bezier(.34,1.2,.64,1)',
        maxHeight:     '80vh',
        display:       'flex',
        flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E5E5' }} />
        </div>

        {/* Header */}
        <div style={{
          padding:       '12px 20px',
          display:       'flex',
          justifyContent:'space-between',
          alignItems:    'center',
          borderBottom:  '0.5px solid #F0F0F0',
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
              Notifikasi Pembayaran
            </h2>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
              {notifs.length} transaksi{unread > 0 ? ` · ${unread} belum dibaca` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                style={{
                  fontSize: 11, color: '#2563eb', fontWeight: 600,
                  background: '#EFF6FF', border: 'none',
                  borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                }}
              >
                Baca semua
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none',
                background: '#F5F5F5', cursor: 'pointer', fontSize: 16,
                color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Tutup panel"
            >
              ×
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifs.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🔔</p>
              <p style={{ fontSize: 13, color: '#9ca3af' }}>Belum ada notifikasi pembayaran</p>
              <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>
                Notifikasi akan muncul saat pelanggan menyelesaikan pembayaran
              </p>
            </div>
          ) : notifs.map((n) => {
            const customer = customerFor(n);
            return (
              <div
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                style={{
                  padding:       '14px 20px',
                  borderBottom:  '0.5px solid #F5F5F5',
                  background:    n.read ? '#fff' : '#F5F9FF',
                  cursor:        'pointer',
                  display:       'flex',
                  gap:           14,
                  alignItems:    'flex-start',
                }}
              >
                {/* Read/unread dot */}
                <div style={{ paddingTop: 5, flexShrink: 0 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: n.read ? '#E5E5E5' : '#2563EB',
                  }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize:     14,
                    fontWeight:   n.read ? 500 : 700,
                    color:        '#111',
                    fontFamily:   "'DM Mono', monospace",
                    letterSpacing:'-.3px',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {n.txn}
                  </p>
                  <p style={{ fontSize: 12, color: '#888', marginTop: 5 }}>
                    {customer ? `${customer} · ` : ''}{fmtFull(n.ts)}
                  </p>
                </div>

                {!n.read && (
                  <span style={{
                    flexShrink:    0,
                    fontSize:      9,
                    fontWeight:    700,
                    letterSpacing: '.5px',
                    background:    '#DBEAFE',
                    color:         '#1D4ED8',
                    padding:       '3px 8px',
                    borderRadius:  99,
                    marginTop:     3,
                  }}>
                    BARU
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
