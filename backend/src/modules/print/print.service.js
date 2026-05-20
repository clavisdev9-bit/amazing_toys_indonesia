'use strict';

const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const logger    = require('../../config/logger');
const { AppError } = require('../../middlewares/error.middleware');
const adminSvc  = require('../admin/admin.service');

const EVENT_NAME  = 'AMAZING TOYS FAIR';
const EVENT_VENUE = 'JCC Senayan, Jakarta';
const EVENT_DATE  = '19-21 Mei 2026';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function rpad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

/**
 * Resolve printer IP/port for a given userId.
 * Priority: per-user assignment → global config → env var.
 */
async function resolvePrinter(userId) {
  const cfg = await adminSvc.getSystemConfig();
  const assignments = Array.isArray(cfg.printer_assignments) ? cfg.printer_assignments : [];

  // 1. Per-user assignment
  const assignment = userId ? assignments.find((a) => a.user_id === userId) : null;
  if (assignment && assignment.printer_ip && assignment.printer_ip.trim()) {
    return {
      ip:   assignment.printer_ip.trim(),
      port: parseInt(assignment.printer_port || 9100, 10),
    };
  }

  // 2. Global config
  const globalIp = (cfg.printer_ip && cfg.printer_ip.trim()) || process.env.PRINTER_IP || '';
  if (globalIp) {
    return {
      ip:   globalIp,
      port: parseInt(cfg.printer_port || process.env.PRINTER_PORT || '9100', 10),
    };
  }

  return null;
}

async function printReceipt({ txn, success, cashierName, customer, cashReceived, userId }) {
  const printer_addr = await resolvePrinter(userId);

  if (!printer_addr) {
    throw new AppError('IP Printer belum dikonfigurasi. Atur di Admin → Konfigurasi → Printer Thermal.', 503);
  }

  const { ip: printerIp, port: printerPort } = printer_addr;

  const printer = new ThermalPrinter({
    type:          PrinterTypes.EPSON,
    interface:     `tcp://${printerIp}:${printerPort}`,
    characterSet:  CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    breakLine:     BreakLine.CHARACTER,
    options: { timeout: 3000 },
  });

  const items        = txn?.items ?? [];
  const txnId        = txn?.transaction_id ?? 'TXN-UNKNOWN';
  const paidAt       = success?.paidAt ?? txn?.checkout_time;
  const payMethod    = success?.paymentMethod ?? '-';
  const cashChange   = success?.cashChange ?? null;
  const subtotal     = parseFloat(txn?.subtotal_amount ?? 0);
  const taxAmt       = parseFloat(txn?.tax_amount ?? 0);
  const taxRate      = parseFloat(txn?.tax_rate ?? 12);
  const grandTotal   = parseFloat(txn?.total_amount ?? 0);
  const hasTax       = taxAmt > 0;
  const itemCount    = items.reduce((s, i) => s + (i.quantity || 1), 0);

  // ── Header ────────────────────────────────────────────────────────────────
  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(1, 1);
  printer.println(EVENT_NAME);
  printer.setTextNormal();
  printer.bold(false);
  printer.println(EVENT_VENUE);
  printer.println(EVENT_DATE);
  printer.drawLine();

  // ── Transaction meta ──────────────────────────────────────────────────────
  printer.alignLeft();
  printer.println(`Trx ID  : #${txnId}`);
  printer.println(`Tanggal : ${formatDate(paidAt)}`);
  printer.println(`Kasir   : ${cashierName ?? '-'}`);
  if (customer?.name)  printer.println(`Customer: ${customer.name}`);
  if (customer?.phone) printer.println(`Telp    : ${customer.phone}`);
  printer.drawLine();

  // ── Items ─────────────────────────────────────────────────────────────────
  printer.bold(true);
  printer.println('PRODUK YANG DIBELI');
  printer.bold(false);

  for (const item of items) {
    const qty   = item.quantity || 1;
    const total = formatRupiah((item.unit_price ?? 0) * qty);
    const name  = item.product_name ?? '-';

    // Product name line (wraps if needed)
    printer.println(name);
    // sub-line: tenant / booth / qty × price
    const sub = [item.tenant_name, item.booth_location].filter(Boolean).join(' / ');
    printer.println(`  ${sub}  x${qty}  ${total}`);
  }

  printer.drawLine();

  // ── Totals ────────────────────────────────────────────────────────────────
  const COL = 32; // total line width on 80mm / 42 char mode
  printer.println(
    pad(`Subtotal (${itemCount} item)`, COL - 14) +
    rpad(formatRupiah(hasTax ? subtotal : grandTotal), 14),
  );
  printer.println(
    pad(`PPN ${taxRate}%`, COL - 14) + rpad(formatRupiah(taxAmt), 14),
  );

  printer.bold(true);
  printer.setTextSize(1, 0);
  printer.println(pad('TOTAL', COL - 14) + rpad(formatRupiah(grandTotal), 14));
  printer.setTextNormal();
  printer.bold(false);

  if (cashReceived != null) {
    printer.println(pad('Tunai diterima', COL - 14) + rpad(formatRupiah(cashReceived), 14));
  }
  if (cashChange != null) {
    printer.println(pad('Kembalian', COL - 14) + rpad(formatRupiah(cashChange), 14));
  }

  printer.drawLine();

  printer.bold(true);
  printer.println(`PEMBAYARAN: ${payMethod.toUpperCase()}`);
  printer.bold(false);

  // ── Pickup reminder ───────────────────────────────────────────────────────
  const tenantMap = new Map();
  for (const item of items) {
    const key = item.tenant_id ?? item.tenant_name;
    if (!tenantMap.has(key)) {
      tenantMap.set(key, { name: item.tenant_name, booth: item.booth_location });
    }
  }
  const tenants = Array.from(tenantMap.values());

  if (tenants.length > 0) {
    printer.newLine();
    printer.bold(true);
    printer.println('AMBIL PESANAN DI:');
    printer.bold(false);
    for (const t of tenants) {
      printer.println(`  ${t.name ?? '-'}  —  ${t.booth ?? '-'}`);
    }
    printer.println('  Tunjukkan struk ini di setiap booth.');
  }

  printer.drawLine();

  // ── QR Code ───────────────────────────────────────────────────────────────
  printer.alignCenter();
  printer.printQR(txnId, {
    cellSize:        6,   // 6 = largest native cell, clear scan at 203 DPI
    correction:      'H', // 30% error correction
    model:           2,
  });
  printer.println('Scan untuk struk digital');
  printer.println(txnId);
  printer.newLine();

  // ── Footer ────────────────────────────────────────────────────────────────
  printer.bold(true);
  printer.println('Terima kasih telah berbelanja!');
  printer.bold(false);
  printer.println('Simpan struk ini sebagai bukti pembelian.');
  printer.println('amazingtoyfair.id');
  printer.newLine();
  printer.newLine();
  printer.cut();

  try {
    await printer.execute();
  } catch (execErr) {
    throw new AppError(`Gagal mengirim data ke printer (${printerIp}:${printerPort}): ${execErr.message}`, 503);
  }
  logger.info(`[Print] Receipt printed: ${txnId} → ${printerIp}:${printerPort}`);
}

module.exports = { printReceipt, resolvePrinter };
