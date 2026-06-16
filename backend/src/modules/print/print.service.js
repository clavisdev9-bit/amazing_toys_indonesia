'use strict';

const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { execFile }    = require('child_process');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');
const { promisify }   = require('util');
const execFileAsync   = promisify(execFile);
const writeFileAsync  = promisify(fs.writeFile);
const unlinkAsync     = promisify(fs.unlink);
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

// PowerShell script template — sends raw ESC/POS bytes via winspool.drv (bypasses GDI/PDF path)
const RAW_PRINT_PS = `
param([string]$PrinterName, [string]$FilePath)
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class WinSpool {
  [DllImport("winspool.drv",CharSet=CharSet.Auto,SetLastError=true)]
  public static extern bool OpenPrinter(string n,ref IntPtr h,IntPtr d);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
  public struct DOCINFO {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.drv",CharSet=CharSet.Ansi,SetLastError=true)]
  public static extern int StartDocPrinterA(IntPtr h,int l,ref DOCINFO d);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h,byte[] b,int c,ref int w);
}
'@
$h=[IntPtr]::Zero
if(-not [WinSpool]::OpenPrinter($PrinterName,[ref]$h,[IntPtr]::Zero)){
  throw "OpenPrinter gagal untuk '$PrinterName'. Pastikan nama printer Windows sudah benar."
}
try {
  $d=New-Object WinSpool+DOCINFO; $d.pDocName="ESC/POS Receipt"; $d.pDataType="RAW"
  $jobId=[WinSpool]::StartDocPrinterA($h,1,[ref]$d)
  if($jobId -le 0){ throw "StartDocPrinter gagal (job id=$jobId)" }
  [WinSpool]::StartPagePrinter($h) | Out-Null
  $written=0
  [WinSpool]::WritePrinter($h,$bytes,$bytes.Length,[ref]$written) | Out-Null
  [WinSpool]::EndPagePrinter($h) | Out-Null
  [WinSpool]::EndDocPrinter($h) | Out-Null
} finally {
  [WinSpool]::ClosePrinter($h) | Out-Null
}
Write-Output "OK bytes_written=$written"
`.trim();

/**
 * Send a raw ESC/POS buffer to a Windows USB printer via winspool.drv (RAW datatype).
 * This bypasses the GDI/spooler PDF-conversion path.
 */
async function sendRawWindowsUSB(printerName, buffer) {
  const tmpDir  = os.tmpdir();
  const jobKey  = `escpos_${process.hrtime.bigint()}`;
  const binFile = path.join(tmpDir, `${jobKey}.bin`);
  const psFile  = path.join(tmpDir, `${jobKey}.ps1`);

  try {
    await writeFileAsync(binFile, buffer);
    // Write PS as UTF-8 with BOM so PowerShell reads it correctly
    await writeFileAsync(psFile, '﻿' + RAW_PRINT_PS, 'utf8');

    const { stdout, stderr } = await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', psFile,
      '-PrinterName', printerName,
      '-FilePath', binFile,
    ], { timeout: 15000 });

    if (stderr && stderr.trim()) logger.warn(`[Print] PS stderr: ${stderr.trim()}`);
    logger.info(`[Print] USB raw print OK: ${stdout.trim()}`);
  } finally {
    for (const f of [binFile, psFile]) {
      try { await unlinkAsync(f); } catch { /* best-effort cleanup */ }
    }
  }
}

/**
 * Resolve printer connection info for a given userId.
 * Returns { type: 'TCP', ip, port } | { type: 'USB', usbName } | null
 *
 * Priority: per-user assignment → global config → env var.
 */
async function resolvePrinter(userId) {
  const cfg = await adminSvc.getSystemConfig();
  const assignments = Array.isArray(cfg.printer_assignments) ? cfg.printer_assignments : [];

  // 1. Per-user assignment
  const assignment = userId ? assignments.find((a) => a.user_id === userId) : null;
  if (assignment) {
    const assignType = (assignment.printer_type || 'TCP').toUpperCase();
    if (assignType === 'USB') {
      const usbName = (assignment.printer_usb_name || '').trim();
      if (usbName) return { type: 'USB', usbName };
    } else if (assignment.printer_ip && assignment.printer_ip.trim()) {
      return { type: 'TCP', ip: assignment.printer_ip.trim(), port: parseInt(assignment.printer_port || 9100, 10) };
    }
  }

  // 2. Global config
  const globalType = (cfg.printer_type || 'TCP').toUpperCase();
  if (globalType === 'USB') {
    const usbName = (cfg.printer_usb_name || '').trim();
    if (usbName) return { type: 'USB', usbName };
  } else {
    const globalIp = (cfg.printer_ip && cfg.printer_ip.trim()) || process.env.PRINTER_IP || '';
    if (globalIp) {
      return { type: 'TCP', ip: globalIp, port: parseInt(cfg.printer_port || process.env.PRINTER_PORT || '9100', 10) };
    }
  }

  return null;
}

async function printReceipt({ txn, success, cashierName, customer, cashReceived, userId }) {
  const printer_addr = await resolvePrinter(userId);

  if (!printer_addr) {
    throw new AppError(
      'Printer belum dikonfigurasi. Atur di Admin → Konfigurasi → Printer Thermal (TCP/IP atau USB).',
      503,
    );
  }

  // For Windows USB we will use winspool raw print — interface is only needed for TCP/Linux-USB
  const isWindowsUsb = printer_addr.type === 'USB' && !printer_addr.usbName.startsWith('/dev/');
  const isLinuxUsb   = printer_addr.type === 'USB' && printer_addr.usbName.startsWith('/dev/');

  let interfaceStr;
  let addrLabel;
  if (isWindowsUsb) {
    // Dummy interface — we bypass node-thermal-printer's execute() and use winspool directly
    interfaceStr = `tcp://127.0.0.1:9`;
    addrLabel    = `USB:${printer_addr.usbName}`;
  } else if (isLinuxUsb) {
    interfaceStr = printer_addr.usbName;
    addrLabel    = `USB:${printer_addr.usbName}`;
  } else {
    interfaceStr = `tcp://${printer_addr.ip}:${printer_addr.port}`;
    addrLabel    = `${printer_addr.ip}:${printer_addr.port}`;
  }

  const printer = new ThermalPrinter({
    type:          PrinterTypes.EPSON,
    interface:     interfaceStr,
    characterSet:  CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    breakLine:     BreakLine.CHARACTER,
    options: { timeout: 3000 },
  });

  const cfg          = await adminSvc.getSystemConfig();
  const contactEmail = cfg.contact_email || '';
  const items        = txn?.items ?? [];
  const txnId        = txn?.transaction_id ?? 'TXN-UNKNOWN';
  const paidAt       = success?.paidAt ?? txn?.checkout_time;
  const payMethod    = success?.paymentMethod ?? '-';
  const cashChange   = success?.cashChange ?? null;
  const taxRate      = parseFloat(txn?.tax_rate ?? 0);
  const grandTotal   = parseFloat(txn?.total_amount ?? 0);

  // ── Header ────────────────────────────────────────────────────────────────
  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(2, 2);
  printer.println(EVENT_NAME);
  printer.setTextNormal();
  printer.setTextSize(1, 1);          // #2-3 venue & tanggal
  printer.bold(true);
  printer.println(EVENT_VENUE);
  printer.println(EVENT_DATE);
  printer.bold(false);
  printer.setTextNormal();
  printer.alignLeft();
  printer.println('='.repeat(42));

  printer.setTextSize(1, 1);          // #4-5 label & nilai meta
  printer.bold(true);
  printer.println(`Trx ID  : #${txnId}`);
  printer.println(`Tanggal : ${formatDate(paidAt)}`);
  printer.println(`Kasir   : ${cashierName ?? '-'}`);
  if (customer?.name) {
    printer.println(`Customer: ${customer.name}`);
  }
  if (customer?.phone) {
    printer.println(`Telp    : ${customer.phone}`);
  }
  printer.bold(false);
  printer.setTextNormal();
  printer.println('='.repeat(42));

  printer.alignCenter();              // #6 section title — setTextSize(1,2)
  printer.bold(true);
  printer.setTextSize(1, 2);
  printer.println('PRODUK YANG DIBELI');
  printer.bold(false);
  printer.setTextNormal();
  printer.alignLeft();

  for (const item of items) {
    const qty   = item.quantity || 1;
    const total = formatRupiah(Math.round((item.unit_price ?? 0) * qty * (1 + taxRate / 100)));
    const name  = item.product_name ?? '-';
    const sub   = [item.tenant_name, item.booth_location].filter(Boolean).join(' / ');

    printer.setTextSize(2, 1);        // #7 nama produk, #8 harga, #9 sub-line
    printer.bold(true);
    printer.alignLeft();
    printer.println(name);
    printer.alignRight();
    printer.println(total);
    printer.alignLeft();
    printer.println(`  ${sub}  x${qty}`);
    printer.bold(false);
    printer.setTextNormal();
  }

  printer.println('='.repeat(42));

  // ── Totals ────────────────────────────────────────────────────────────────
  const discountVal = parseFloat(txn?.discount_amount ?? 0);
  const voucherCode = txn?.voucher_code || '';

  if (discountVal > 0) {
    const discLabel = voucherCode ? `Diskon (${voucherCode})` : 'Diskon';
    printer.setTextSize(1, 1);
    printer.alignLeft();
    printer.println(discLabel);
    printer.alignRight();
    printer.println(`-${formatRupiah(discountVal)}`);
    printer.setTextNormal();
    printer.alignLeft();
  }

  printer.bold(true);               // #10-11 TOTAL + nilai — setTextSize(2,2), baris terpisah
  printer.setTextSize(2, 2);
  printer.alignLeft();
  printer.println('TOTAL');
  printer.alignRight();
  printer.println(formatRupiah(grandTotal));
  printer.alignLeft();
  printer.setTextNormal();
  printer.bold(false);

  if (cashReceived != null) {
    printer.setTextSize(1, 1);
    printer.alignLeft();
    printer.println('Tunai diterima');
    printer.alignRight();
    printer.println(formatRupiah(cashReceived));
    printer.setTextNormal();
    printer.alignLeft();
  }
  if (cashChange != null) {
    printer.setTextSize(1, 1);
    printer.alignLeft();
    printer.println('Kembalian');
    printer.alignRight();
    printer.println(formatRupiah(cashChange));
    printer.setTextNormal();
    printer.alignLeft();
  }

  printer.println('='.repeat(42));

  printer.bold(true);               // #12 badge — setTextSize(0,1), center
  printer.setTextSize(0, 1);
  printer.alignCenter();
  printer.println(`LUNAS — ${payMethod.toUpperCase()}`);
  printer.bold(false);
  printer.setTextNormal();
  printer.alignLeft();

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
    printer.alignCenter();
    printer.bold(true);             // #6 section title — setTextSize(1,2)
    printer.setTextSize(1, 2);
    printer.println('AMBIL PESANAN DI:');
    printer.setTextNormal();
    for (const t of tenants) {
      printer.setTextSize(1, 1);    // #13-14 nama tenant & booth — setTextSize(1,1)
      printer.bold(true);
      printer.println(t.name ?? '-');
      printer.println(t.booth ?? '-');
      printer.bold(false);
      printer.setTextNormal();
    }
    printer.alignLeft();
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
  printer.setTextSize(2, 1);          // #15 label scan QR — setTextSize(2,1), bold
  printer.bold(true);
  printer.println('Scan untuk struk digital');
  printer.bold(false);
  printer.setTextSize(1, 1);          // #16 ID transaksi — setTextSize(1,1), tidak bold
  printer.println(txnId);
  printer.setTextNormal();
  printer.newLine();

  printer.setTextSize(1, 1);          // #17 terima kasih — setTextSize(1,1), bold
  printer.bold(true);
  printer.println('Terima kasih telah berbelanja!');
  printer.bold(false);
  printer.println('Simpan struk ini sebagai bukti pembelian.'); // #18 sub-footer
  if (contactEmail) printer.println(contactEmail);              // #19 email
  printer.setTextNormal();
  printer.newLine();
  printer.newLine();
  printer.cut();

  try {
    if (isWindowsUsb) {
      // Send raw ESC/POS buffer directly via winspool (bypasses GDI/PDF conversion)
      const rawBuffer = printer.getBuffer();
      await sendRawWindowsUSB(printer_addr.usbName, rawBuffer);
    } else {
      await printer.execute();
    }
  } catch (execErr) {
    const hint = isWindowsUsb
      ? `Pastikan nama printer Windows sudah benar (Admin → Konfigurasi → Printer USB) dan printer terhubung.`
      : printer_addr.type === 'USB'
        ? `Pastikan device USB (${printer_addr.usbName}) dapat diakses.`
        : `Pastikan printer menyala dan terhubung ke jaringan.`;
    throw new AppError(`Gagal mengirim data ke printer (${addrLabel}): ${execErr.message}. ${hint}`, 503);
  }
  logger.info(`[Print] Receipt printed: ${txnId} → ${addrLabel} [${printer_addr.type}]`);
}

module.exports = { printReceipt, resolvePrinter };
