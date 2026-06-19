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

const S = {
  root: {
    width: '100%',
    fontFamily: MONO,
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#000',
    lineHeight: '1.5',
    background: '#fff',
    WebkitFontSmoothing: 'none',
    MozOsxFontSmoothing: 'unset',
  },
  logoZone: {
    textAlign: 'center',
    paddingBottom: '11px',
  },
  logo: {
    width: '74px',
    height: 'auto',
    display: 'block',
    margin: '0 auto 7px',
  },
  eventName: {
    fontFamily: MONO,
    fontSize: '25px',
    fontWeight: '900',
    letterSpacing: '0.3px',
    lineHeight: '1.08',
    marginTop: '5px',
    color: '#000',
    textTransform: 'uppercase',
  },
  eventSub: {
    fontFamily: MONO,
    fontSize: '12.5px',
    fontWeight: '800',
    color: '#000',
    marginTop: '3px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    fontSize: '12px',
    color: '#000',
    marginBottom: '4px',
  },
  metaKey: { color: '#000', fontWeight: '900', whiteSpace: 'nowrap', fontSize: '12px' },
  metaVal: { fontWeight: '700', fontSize: '12px', textAlign: 'right' },
  ruleSolid:  { border: 'none', borderTop: '2px solid #000', margin: '9px 0' },
  ruleDashed: { border: 'none', borderTop: '2px dashed #000', margin: '9px 0' },
  ruleHair:   { border: 'none', borderTop: '1px solid #9a9a9a', margin: '9px 0' },
  sectionTitle: {
    fontFamily: MONO,
    fontSize: '15px',
    fontWeight: '900',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#000',
    marginBottom: '7px',
  },
  pickupTitle: {
    fontFamily: MONO,
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#000',
    marginBottom: '7px',
  },
  itemWrap: { marginBottom: '9px' },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '8px',
    color: '#000',
  },
  itemName:  { flex: 1, lineHeight: '1.3', fontWeight: '800', fontSize: '13px' },
  itemPrice: { whiteSpace: 'nowrap', fontWeight: '800', fontSize: '13px' },
  itemSub:   { fontSize: '11.5px', color: '#555', fontWeight: 'bold', marginTop: '2px' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    fontSize: '11px',
    color: '#000',
    marginBottom: '3px',
    fontWeight: 'bold',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '10px',
    fontFamily: MONO,
    fontSize: '21px',
    fontWeight: '900',
    color: '#000',
    marginTop: '4px',
  },
  payBadge: {
    display: 'inline-block',
    background: '#000',
    color: '#fff',
    fontFamily: MONO,
    padding: '4px 13px',
    fontSize: '11.5px',
    fontWeight: '800',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginTop: '9px',
  },
  qrZone: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    margin: '4px 0',
    padding: '9px',
    border: '1.5px solid #000',
  },
  qrText: { fontSize: '11.5px', color: '#000', lineHeight: '1.45', flex: 1 },
  footer:       { textAlign: 'center', marginTop: '11px' },
  footerStrong: { fontFamily: MONO, fontSize: '13px', fontWeight: '900', color: '#000' },
  footerLine:   { fontFamily: MONO, fontSize: '11px', color: '#555', fontWeight: 'bold', lineHeight: '1.6' },
  footerMail:   { fontFamily: MONO, fontSize: '10.5px', color: '#555', fontWeight: 'bold', lineHeight: '1.6', marginTop: '6px' },
};


export default function ThermalReceipt({
  txn,
  success,
  cashierName,
  customer,
  cashReceived = null,
  qrSize = 88,
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
  const isPreorder    = (txn?.order_type ?? success?.orderType) === 'PREORDER';

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

      {/* Header */}
      <div style={S.logoZone}>
        <img src={publicCfg?.logo_url || '/logo.png'} alt={eventName} style={S.logo} />
        <div style={S.eventName}>{eventName}</div>
        <div style={S.eventSub}>{eventVenue}</div>
        <div style={S.eventSub}>{eventDate}</div>
      </div>

      <hr style={S.ruleSolid} />

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

      <hr style={S.ruleDashed} />

      {/* CR-05X: PRE-ORDER warning box */}
      {isPreorder && (
        <div style={{ border: '1px solid #000', padding: '6px 8px', marginBottom: '8px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', color: '#000' }}>
            *** PRE-ORDER TRANSACTION ***
          </div>
          <div style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 'bold', color: '#555', marginTop: '2px' }}>
            Barang akan dikirim — tidak diambil di booth.
          </div>
          {txn?.shipping_name && (
            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#000', marginTop: '4px', fontWeight: 'bold' }}>
              Dikirim ke: {txn.shipping_name}{txn.shipping_city ? `, ${txn.shipping_city}` : ''}
            </div>
          )}
          {txn?.shipping_address && (
            <div style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 'bold', color: '#555', marginTop: '1px' }}>
              {txn.shipping_address}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div style={S.sectionTitle}>Items Purchased</div>
      {items.filter(item => item.approval_status !== 'REJECTED').map((item, i) => (
        <div key={i} style={S.itemWrap}>
          <div style={S.itemTop}>
            <span style={S.itemName}>{item.product_name}</span>
            <span style={S.itemPrice}>{formatRupiah(item.subtotal)}</span>
          </div>
          <div style={S.itemSub}>
            {[item.tenant_name, item.booth_location, `x${item.approved_quantity ?? item.quantity}`]
              .filter(Boolean)
              .join(' / ')}
          </div>
        </div>
      ))}

      <hr style={S.ruleSolid} />

      {/* Totals */}
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
          <span style={S.payBadge}>Paid &middot; {paymentMethod}</span>
        </div>
      )}

      <hr style={S.ruleDashed} />

      {/* Pickup reminder — hidden for pre-order */}
      {!isPreorder && tenantGroups.length > 0 && (
        <>
          <div style={S.pickupTitle}>Collect Your Items At</div>
          <div style={{ textAlign: 'center' }}>
            {tenantGroups.map((g, i) => (
              <div key={i} style={{ marginBottom: '6px' }}>
                <div style={{ fontFamily: MONO, fontWeight: 'bold', fontSize: '10px', lineHeight: '1.2', color: '#000' }}>
                  {g.tenantName}
                </div>
                <div style={{ fontFamily: MONO, fontWeight: 'bold', fontSize: '10px', lineHeight: '1.2', marginTop: '2px', color: '#000' }}>
                  {g.boothLocation || '-'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#555', marginTop: '6px', fontWeight: 'bold', textAlign: 'center' }}>
            Show your pickup slip at each booth.
          </div>
          <hr style={S.ruleHair} />
        </>
      )}

      {/* QR Code — level H = 30% error correction */}
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
          <span style={{ fontWeight: 'bold' }}>Scan for your<br />digital receipt</span>
          <div style={{ height: '8px' }} />
          <span style={{ fontWeight: 'bold', fontSize: '10px', wordBreak: 'break-all' }}>{txnId}</span>
        </div>
      </div>

      <hr style={S.ruleHair} />

      {/* Footer */}
      <div style={S.footer}>
        <div style={S.footerStrong}>Thank you for visiting!</div>
        <div style={S.footerLine}>Keep this receipt for your records.</div>
        {publicCfg?.contact_email && (
          <div style={S.footerMail}>{publicCfg.contact_email}</div>
        )}
      </div>

    </div>
  );
}
