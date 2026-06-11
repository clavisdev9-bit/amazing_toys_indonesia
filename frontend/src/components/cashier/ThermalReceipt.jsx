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

// No static fallbacks — values always come from /config/public (admin config).
// bustPublicConfigCache() is called by ConfigTab on save, so the next receipt
// render always reads the latest admin-configured values.

/*
 * Font strategy for thermal printers:
 *   - Primary: Courier New  (system font, no internet required, designed for fixed-pitch print)
 *   - Weights capped at 600  — weights 700+ spread heat on thermal head → blur
 *   - Colors: pure #000 for important text, #555 for secondary
 */
const MONO  = "'Courier New', Courier, monospace";
const SANS  = "Arial, Helvetica, sans-serif";

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
  itemWrap: { marginBottom: '8px' },
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

export default function ThermalReceipt({
  txn,
  success,
  cashierName,
  customer,
  cashReceived = null,
  qrSize = 100,
}) {
  const publicCfg = usePublicConfig();

  const eventName  = publicCfg?.event_name || '';
  const eventVenue = publicCfg?.venue       || '';
  const eventDate  = publicCfg?.event_date_start
    ? formatEventDateRange(publicCfg.event_date_start, publicCfg.event_date_end)
    : '';

  const paidAt        = success?.paidAt ?? txn?.checkout_time;
  const paymentMethod = success?.paymentMethod;
  const cashChange    = success?.cashChange ?? null;
  const items         = txn?.items ?? [];
  const taxRate       = parseFloat(txn?.tax_rate ?? 0);
  const itemCount     = items.filter(i => i.approval_status !== 'REJECTED').reduce((sum, i) => sum + (i.approved_quantity ?? i.quantity ?? 1), 0);

  const tenantMap = new Map();
  for (const item of items) {
    const key = item.tenant_id ?? item.tenant_name;
    if (!tenantMap.has(key)) {
      tenantMap.set(key, { tenantName: item.tenant_name, boothLocation: item.booth_location });
    }
  }
  const tenantGroups = Array.from(tenantMap.values());
  const txnId = txn?.transaction_id ?? 'TXN-UNKNOWN';

  return (
    <div style={S.root}>

      {/* Logo zone */}
      <div style={S.logoZone}>
        <ToyIcon />
        <div style={S.eventName}>{eventName}</div>
        <div style={S.eventSub}>{eventVenue}</div>
        <div style={S.eventSub}>{eventDate}</div>
      </div>

      {/* Transaction meta */}
      <div style={S.metaRow}>
        <span style={S.metaKey}>Transaction ID</span>
        <span style={S.metaVal}>#{txnId}</span>
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

      {/* Items */}
      <div style={S.sectionTitle}>Items Purchased</div>
      {items.filter(item => item.approval_status !== 'REJECTED').map((item, i) => (
        <div key={i} style={S.itemWrap}>
          <div style={S.itemTop}>
            <span style={S.itemName}>{item.product_name}</span>
            <span style={S.itemPrice}>{formatRupiah(Math.round(item.subtotal * (1 + taxRate / 100)))}</span>
          </div>
          <div style={S.itemSub}>
            {[item.tenant_name, item.booth_location, `x${item.approved_quantity ?? item.quantity}`]
              .filter(Boolean)
              .join(' / ')}
          </div>
        </div>
      ))}

      <hr style={S.ruleSolid} />

      {/* Totals — item prices include tax; discount shown if applicable */}
      {parseFloat(txn?.discount_amount ?? 0) > 0 && (
        <div style={{ ...S.totalRow, color: '#2a7a5a' }}>
          <span>Diskon{txn?.voucher_code ? ` (${txn.voucher_code})` : ''}</span>
          <span>− {formatRupiah(parseFloat(txn.discount_amount))}</span>
        </div>
      )}
      <div style={S.grandTotal}>
        <span>TOTAL</span>
        <span>{formatRupiah(parseFloat(txn?.total_amount ?? 0))}</span>
      </div>

      {cashReceived != null && (
        <div style={{ ...S.totalRow, marginTop: '6px' }}>
          <span>Cash received</span>
          <span>{formatRupiah(cashReceived)}</span>
        </div>
      )}
      {cashChange != null && (
        <div style={S.totalRow}>
          <span>Change</span>
          <span>{formatRupiah(cashChange)}</span>
        </div>
      )}

      {paymentMethod && (
        <div>
          <span style={S.payBadge}>PAID - {paymentMethod}</span>
        </div>
      )}

      <hr style={S.ruleDouble} />

      {/* Pickup reminder */}
      {tenantGroups.length > 0 && (
        <>
          <div style={S.sectionTitle}>Collect your items at</div>
          {tenantGroups.map((g, i) => (
            <div key={i} style={S.metaRow}>
              <span>{g.tenantName}</span>
              <span style={S.metaVal}>{g.boothLocation || '-'}</span>
            </div>
          ))}
          <div style={{ fontFamily: SANS, fontSize: '10px', color: '#555', marginTop: '4px' }}>
            Show your pickup slip at each booth.
          </div>
          <hr style={S.ruleDashed} />
        </>
      )}

      {/* QR Code — level H = 30% error correction, tolerates print blur */}
      <div style={S.qrZone}>
        <QRCodeSVG
          value={txnId}
          size={qrSize}
          level="H"
          includeMargin={true}
          fgColor="#000000"
          bgColor="#ffffff"
        />
        <div style={S.qrText}>
          <span style={{ fontWeight: '600' }}>Scan for your</span><br />
          <span style={{ fontWeight: '600' }}>digital receipt</span><br /><br />
          {txnId}
        </div>
      </div>

      <hr style={S.ruleDashed} />

      {/* Footer */}
      <div style={S.footer}>
        <div style={{ ...S.footerLine, marginBottom: '6px' }}>* Item prices include tax.</div>
        <div style={S.footerStrong}>Thank you for visiting!</div>
        <div style={S.footerLine}>Keep this receipt for your records.</div>
        {publicCfg?.contact_email && (
          <div style={{ ...S.footerLine, marginTop: '6px', fontSize: '9px' }}>
            {publicCfg.contact_email}
          </div>
        )}
      </div>

    </div>
  );
}
