import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatRupiah, formatDate } from '../../utils/format';

const EVENT_NAME  = 'AMAZING TOYS FAIR';
const EVENT_VENUE = 'JCC Senayan, Jakarta';
const EVENT_DATE  = '19-21 Mei 2026';

/**
 * VISUAL LAYOUT NOTE:
 * ------------------------------------------
 * [LOGO / EVENT INFO]
 * ------------------------------------------
 * Transaction ID | Date | Cashier | Customer
 * - - - - - - - - - - - - - - - - - - - - -
 * ITEMS PURCHASED (List: Name, Price, Tenant)
 * __________________________________________
 * Subtotal | Tax | TOTAL (Bold)
 * Cash Received | Change
 * [ PAID - METHOD ]
 * ==========================================
 * PICKUP LOCATIONS (Tenant List)
 * - - - - - - - - - - - - - - - - - - - - -
 * [QR CODE] Scan for digital receipt
 * - - - - - - - - - - - - - - - - - - - - -
 * FOOTER MESSAGE
 * ------------------------------------------
 */

/*
 * Font strategy for thermal printers:
 *   - Primary: Courier New  (system font, no internet required, designed for fixed-pitch print)
 *   - Weights capped at 600  — weights 700+ spread heat on thermal head → blur
 *   - Colors: pure #000 for important text, #555 for secondary
 *     (near-black like #1a1a1a renders the same on screen but can differ per driver)
 */
const MONO  = "'Courier New', Courier, monospace";
const SANS  = "Arial, Helvetica, sans-serif";

const S = {
  root: {
    width: '100%',
    fontFamily: MONO,
    fontSize: '12px',       // slightly larger → easier to read on 203dpi thermal
    color: '#000',
    lineHeight: '1.55',
    background: '#fff',
    WebkitFontSmoothing: 'none',  // disable antialiasing — thermal is binary (dot on/off)
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
    fontWeight: '700',      // was 900 — reduced to avoid heat bleed
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
  metaVal: { fontWeight: '400', textAlign: 'right' },  // was 500
  ruleDashed: { border: 'none', borderTop: '1px dashed #888', margin: '8px 0' },
  ruleSolid:  { border: 'none', borderTop: '1px solid #000', margin: '8px 0' },
  ruleDouble: { border: 'none', borderTop: '2px solid #000', margin: '8px 0' }, // double bleeds → solid
  sectionTitle: {
    fontFamily: SANS,
    fontSize: '10px',
    fontWeight: '600',      // was 600 — OK for section labels
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
    fontWeight: '600',      // was 600 — keep, it's the product name
    color: '#000',
  },
  itemName:  { flex: 1, paddingRight: '6px', lineHeight: '1.35' },
  itemPrice: { whiteSpace: 'nowrap', fontWeight: '400' }, // price doesn't need bold
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
    fontWeight: '600',      // was 700 — reduced
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
    fontWeight: '400',      // was 600 — badge border gives visual weight, no need for heavy text
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
    border: '1px solid #000',  // solid looks cleaner on thermal than dashed
  },
  qrText: { fontSize: '10px', color: '#000', lineHeight: '1.5', flex: 1 },
  footer:       { textAlign: 'center', marginTop: '10px' },
  footerStrong: {
    fontFamily: SANS,
    fontSize: '12px',
    fontWeight: '600',      // was 800 — major reduction
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
  const paidAt        = success?.paidAt ?? txn?.checkout_time;
  const paymentMethod = success?.paymentMethod;
  const cashChange    = success?.cashChange ?? null;
  const items         = txn?.items ?? [];
  const itemCount     = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

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
        <div style={S.eventName}>{EVENT_NAME}</div>
        <div style={S.eventSub}>{EVENT_VENUE}</div>
        <div style={S.eventSub}>{EVENT_DATE}</div>
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
      {items.map((item, i) => (
        <div key={i} style={S.itemWrap}>
          <div style={S.itemTop}>
            <span style={S.itemName}>{item.product_name}</span>
            <span style={S.itemPrice}>{formatRupiah(item.unit_price * item.quantity)}</span>
          </div>
          <div style={S.itemSub}>
            {[item.tenant_name, item.booth_location, `x${item.quantity}`]
              .filter(Boolean)
              .join(' / ')}
          </div>
        </div>
      ))}

      <hr style={S.ruleSolid} />

      {/* Totals */}
      {(() => {
        const subtotal  = parseFloat(txn?.subtotal_amount ?? 0);
        const taxAmt    = parseFloat(txn?.tax_amount ?? 0);
        const taxRate   = parseFloat(txn?.tax_rate ?? 12);
        const hasTax    = taxAmt > 0;
        const grandTotal = parseFloat(txn?.total_amount ?? 0);
        return (
          <>
            <div style={S.totalRow}>
              <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
              <span>{formatRupiah(hasTax ? subtotal : grandTotal)}</span>
            </div>
            <div style={S.totalRow}>
              <span>PPN {taxRate}%</span>
              <span>{formatRupiah(taxAmt)}</span>
            </div>
            <div style={S.grandTotal}>
              <span>TOTAL</span>
              <span>{formatRupiah(grandTotal)}</span>
            </div>
          </>
        );
      })()}

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

      {/* QR Code
          level="H" = 30% error correction (vs M=15%) — tolerates slight print blur
          qrSize=100 → ~26mm on 80mm paper — scannable by smartphone & barcode scanner  */}
      <div style={S.qrZone}>
        <QRCodeSVG
          value={txnId}
          size={qrSize}
          level="H"
          includeMargin={true}   // built-in quiet zone — required for reliable scanning
          fgColor="#000000"      // pure black, not near-black
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
        <div style={S.footerStrong}>Thank you for visiting!</div>
        <div style={S.footerLine}>Keep this receipt for your records.</div>
        <div style={{ ...S.footerLine, marginTop: '6px', fontSize: '9px' }}>
          amazingtoyfair.id
        </div>
      </div>

    </div>
  );
}
