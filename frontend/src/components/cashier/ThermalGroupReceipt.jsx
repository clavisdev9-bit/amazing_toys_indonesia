import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatRupiah, formatDate } from '../../utils/format';
import { usePublicConfig } from '../../hooks/useAppLogo';

const BULAN_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function formatEventDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start + 'T00:00:00');
  const e = end ? new Date(end + 'T00:00:00') : null;
  const ms = BULAN_ID[s.getMonth()];
  if (!e || s.getTime() === e.getTime()) return `${s.getDate()} ${ms} ${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.getDate()}-${e.getDate()} ${ms} ${e.getFullYear()}`;
  return `${s.getDate()} ${ms} - ${e.getDate()} ${BULAN_ID[e.getMonth()]} ${e.getFullYear()}`;
}

const MONO = "'Courier New', Courier, monospace";
const SANS = "Arial, Helvetica, sans-serif";

const S = {
  root: {
    width: '100%',
    fontFamily: MONO,
    fontSize: '12px',
    color: '#000',
    lineHeight: '1.55',
    background: '#fff',
    WebkitFontSmoothing: 'none',
    MozOsxFontSmoothing: 'unset',
  },
  logoZone: {
    textAlign: 'center',
    paddingBottom: '10px',
    borderBottom: '1px solid #000',
    marginBottom: '10px',
  },
  eventName: {
    fontFamily: SANS,
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    lineHeight: '1.2',
    marginTop: '5px',
    color: '#000',
  },
  eventSub: {
    fontFamily: SANS,
    fontSize: '10px',
    fontWeight: '400',
    color: '#555',
    marginTop: '2px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#000',
    marginBottom: '3px',
  },
  metaKey: { color: '#555', fontWeight: '400' },
  metaVal: { fontWeight: '400', textAlign: 'right' },
  ruleDashed: { border: 'none', borderTop: '1px dashed #888', margin: '8px 0' },
  ruleSolid:  { border: 'none', borderTop: '1px solid #000', margin: '8px 0' },
  ruleDouble: { border: 'none', borderTop: '2px solid #000', margin: '8px 0' },
  sectionTitle: {
    fontFamily: SANS,
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#000',
    marginBottom: '6px',
  },
  boothLabel: {
    fontFamily: SANS,
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    color: '#000',
    marginBottom: '3px',
    marginTop: '6px',
  },
  itemWrap: { marginBottom: '5px' },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: '12px',
    fontWeight: '600',
    color: '#000',
  },
  itemName:  { flex: 1, paddingRight: '6px', lineHeight: '1.35' },
  itemPrice: { whiteSpace: 'nowrap', fontWeight: '600' },
  itemSub:   { fontSize: '10px', color: '#555', fontWeight: '400', marginTop: '1px', paddingLeft: '2px' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#000',
    marginBottom: '3px',
    fontWeight: '400',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: '600',
    color: '#000',
    marginTop: '5px',
    paddingTop: '5px',
    borderTop: '1px solid #000',
  },
  payBadge: {
    display: 'inline-block',
    border: '1px solid #000',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: '400',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: '#000',
    marginTop: '6px',
  },
  qrZone: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '10px 0 4px',
    padding: '8px',
    border: '1px solid #000',
  },
  qrText: { fontSize: '10px', color: '#000', lineHeight: '1.5', flex: 1 },
  footer:       { textAlign: 'center', marginTop: '10px' },
  footerStrong: {
    fontFamily: SANS,
    fontSize: '12px',
    fontWeight: '600',
    color: '#000',
  },
  footerLine: { fontFamily: SANS, fontSize: '10px', color: '#555', fontWeight: '400', lineHeight: '1.6' },
};

function ToyIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6"  y="14" width="24" height="16" rx="3" fill="#000"/>
      <rect x="9"  y="17" width="7"  height="7"  rx="1" fill="white"/>
      <rect x="20" y="17" width="7"  height="7"  rx="1" fill="white"/>
      <rect x="14" y="6"  width="8"  height="8"  rx="4" fill="#000"/>
      <rect x="16" y="4"  width="4"  height="4"  rx="2" fill="#000"/>
      <circle cx="11" cy="31" r="2.5" fill="white" stroke="#000" strokeWidth="1.5"/>
      <circle cx="25" cy="31" r="2.5" fill="white" stroke="#000" strokeWidth="1.5"/>
    </svg>
  );
}

export default function ThermalGroupReceipt({
  groupCode,
  customer,
  boothBreakdown = {},
  totalAmount,
  cashReceived = null,
  cashChange = null,
  paymentMethod,
  paymentRef,
  cashierName,
  paidAt,
  transactionIds = [],
  qrSize = 100,
}) {
  const publicCfg = usePublicConfig();

  const eventName  = publicCfg?.event_name || '';
  const eventVenue = publicCfg?.venue       || '';
  const eventDate  = publicCfg?.event_date_start
    ? formatEventDateRange(publicCfg.event_date_start, publicCfg.event_date_end)
    : '';

  const booths = Object.keys(boothBreakdown);

  return (
    <div style={S.root}>

      {/* Logo zone */}
      <div style={S.logoZone}>
        <ToyIcon />
        <div style={S.eventName}>{eventName}</div>
        <div style={S.eventSub}>{eventVenue}</div>
        <div style={S.eventSub}>{eventDate}</div>
      </div>

      {/* Group invoice meta */}
      <div style={S.metaRow}>
        <span style={S.metaKey}>Invoice Group</span>
        <span style={{ ...S.metaVal, fontWeight: '600' }}>{groupCode}</span>
      </div>
      <div style={S.metaRow}>
        <span style={S.metaKey}>Date &amp; Time</span>
        <span style={S.metaVal}>{formatDate(paidAt)}</span>
      </div>
      <div style={S.metaRow}>
        <span style={S.metaKey}>Cashier</span>
        <span style={S.metaVal}>{cashierName}</span>
      </div>
      {customer?.name && (
        <div style={S.metaRow}>
          <span style={S.metaKey}>Customer</span>
          <span style={S.metaVal}>{customer.name}</span>
        </div>
      )}
      {customer?.phone && (
        <div style={S.metaRow}>
          <span style={S.metaKey}>Phone</span>
          <span style={S.metaVal}>{customer.phone}</span>
        </div>
      )}

      <hr style={S.ruleDashed} />

      {/* Items per booth */}
      <div style={S.sectionTitle}>Items Per Booth</div>
      {booths.map((booth, bi) => (
        <div key={booth}>
          <div style={S.boothLabel}>{booth}</div>
          <hr style={{ ...S.ruleDashed, margin: '3px 0 5px' }} />
          {(boothBreakdown[booth] ?? []).map((item, i) => (
            <div key={i} style={S.itemWrap}>
              <div style={S.itemTop}>
                <span style={S.itemName}>{item.product_name}</span>
                <span style={S.itemPrice}>{formatRupiah(item.subtotal)}</span>
              </div>
              <div style={S.itemSub}>×{item.approved_quantity ?? item.quantity ?? 1}</div>
            </div>
          ))}
          {bi < booths.length - 1 && <hr style={{ ...S.ruleDashed, margin: '6px 0' }} />}
        </div>
      ))}

      <hr style={S.ruleSolid} />

      {/* Totals */}
      <div style={S.grandTotal}>
        <span>TOTAL</span>
        <span>{formatRupiah(parseFloat(totalAmount ?? 0))}</span>
      </div>

      {cashReceived != null && cashReceived > 0 && (
        <div style={{ ...S.totalRow, marginTop: '6px' }}>
          <span>Cash received</span>
          <span>{formatRupiah(cashReceived)}</span>
        </div>
      )}
      {cashChange != null && cashChange > 0 && (
        <div style={S.totalRow}>
          <span>Change</span>
          <span>{formatRupiah(cashChange)}</span>
        </div>
      )}

      {paymentMethod && (
        <div>
          <span style={S.payBadge}>
            PAID - {paymentMethod}{paymentRef ? ` · ${paymentRef}` : ''}
          </span>
        </div>
      )}

      <hr style={S.ruleDouble} />

      {/* Pickup reminder */}
      {booths.length > 0 && (
        <>
          <div style={S.sectionTitle}>Ambil Barang di</div>
          {booths.map((booth, i) => (
            <div key={i} style={{ ...S.metaRow, justifyContent: 'flex-start' }}>
              <span>· {booth}</span>
            </div>
          ))}
          <div style={{ fontFamily: SANS, fontSize: '10px', color: '#555', marginTop: '4px' }}>
            Tunjukkan Group Invoice ini di setiap booth.
          </div>
          <hr style={S.ruleDashed} />
        </>
      )}

      {/* QR Code — encodes groupCode so booth staff can scan directly */}
      <div style={S.qrZone}>
        <QRCodeSVG
          value={groupCode || 'GROUP'}
          size={qrSize}
          level="H"
          includeMargin={true}
          fgColor="#000000"
          bgColor="#ffffff"
        />
        <div style={S.qrText}>
          <span style={{ fontWeight: '600' }}>Scan untuk</span><br />
          <span style={{ fontWeight: '600' }}>invoice digital</span><br /><br />
          {groupCode}
        </div>
      </div>

      {/* Transaction ID list */}
      {transactionIds.length > 0 && (
        <>
          <hr style={S.ruleDashed} />
          <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.7' }}>
            <span style={{ fontFamily: SANS, fontWeight: '600', fontSize: '9px', color: '#000' }}>
              Transaksi:
            </span>
            {transactionIds.map((id, i) => (
              <span key={i} style={{ display: 'block', paddingLeft: '4px' }}>· {id}</span>
            ))}
          </div>
        </>
      )}

      <hr style={S.ruleDashed} />

      {/* Footer */}
      <div style={S.footer}>
        <div style={{ ...S.footerLine, marginBottom: '6px' }}>* Harga sudah termasuk pajak.</div>
        <div style={S.footerStrong}>Terima kasih sudah berkunjung!</div>
        <div style={S.footerLine}>Simpan struk ini sebagai bukti pembayaran.</div>
        {publicCfg?.contact_email && (
          <div style={{ ...S.footerLine, marginTop: '6px', fontSize: '9px' }}>
            {publicCfg.contact_email}
          </div>
        )}
      </div>

    </div>
  );
}
