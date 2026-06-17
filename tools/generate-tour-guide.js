const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, TableOfContents,
  LevelFormat, ExternalHyperlink
} = require('C:/Users/arist/AppData/Roaming/npm/node_modules/docx');
const fs = require('fs');

// ── Colours ──────────────────────────────────────────────────────────────────
const COLORS = {
  navy:    '1B3A6B',
  gold:    'C9A227',
  red:     'C4283A',
  olive:   '6B7A2A',
  purple:  '6B3FA0',
  teal:    '0E7C8B',
  orange:  'D4660A',
  gray:    '5A5A5A',
  lightBg: 'F5F0E8',
  white:   'FFFFFF',
  border:  'CCCCCC',
  headerBg:'1B3A6B',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const border = (color = COLORS.border) => ({
  top: { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left: { style: BorderStyle.SINGLE, size: 1, color },
  right: { style: BorderStyle.SINGLE, size: 1, color },
});
const noBorder = () => ({
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
});

function heading1(text, color = COLORS.navy) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, color, font: 'Arial', size: 36 })],
  });
}
function heading2(text, color = COLORS.navy) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, color, font: 'Arial', size: 28 })],
  });
}
function heading3(text, color = COLORS.gray) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, color, font: 'Arial', size: 24 })],
  });
}
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: 'Arial', size: 22, ...opts })],
  });
}
function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: 'Arial', size: 22, ...opts })],
  });
}
function spacer() {
  return new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun('')] });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function divider(color = COLORS.navy) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
    children: [new TextRun('')],
  });
}

function roleHeaderTable(icon, roleLabel, desc, bgColor) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder(),
            shading: { fill: bgColor, type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 240, right: 240 },
            width: { size: 9360, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: `${icon}  ${roleLabel}`, bold: true, font: 'Arial', size: 40, color: COLORS.white })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: desc, font: 'Arial', size: 22, color: 'E0D8CC' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function infoBox(title, items, labelColor = COLORS.navy) {
  const rows = items.map(([label, value]) =>
    new TableRow({
      children: [
        new TableCell({
          borders: border(),
          shading: { fill: 'F0EDE6', type: ShadingType.CLEAR },
          width: { size: 2800, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20, color: labelColor })] })],
        }),
        new TableCell({
          borders: border(),
          width: { size: 6560, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: value, font: 'Arial', size: 20 })] })],
        }),
      ],
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows,
  });
}

function stepTable(steps) {
  const rows = steps.map(([no, step, desc]) =>
    new TableRow({
      children: [
        new TableCell({
          borders: border(COLORS.gold),
          shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
          width: { size: 600, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(no), bold: true, font: 'Arial', size: 22, color: COLORS.white })] })],
        }),
        new TableCell({
          borders: border(),
          shading: { fill: 'FBF7F0', type: ShadingType.CLEAR },
          width: { size: 2200, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: step, bold: true, font: 'Arial', size: 20 })] })],
        }),
        new TableCell({
          borders: border(),
          width: { size: 6560, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: desc, font: 'Arial', size: 20 })] })],
        }),
      ],
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [600, 2200, 6560],
    rows,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const children = [

  // ── COVER ─────────────────────────────────────────────────────────────────
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorder(),
        shading: { fill: COLORS.navy, type: ShadingType.CLEAR },
        width: { size: 9360, type: WidthType.DXA },
        margins: { top: 600, bottom: 600, left: 360, right: 360 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 }, children: [new TextRun({ text: 'Amazing Toys Fair 2026', bold: true, font: 'Arial', size: 56, color: COLORS.white })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }, children: [new TextRun({ text: 'Sistem Hybrid SOS x Odoo 18', font: 'Arial', size: 32, color: 'C9A227' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: 'Panduan Penggunaan Sistem — Semua Role & Modul', font: 'Arial', size: 24, color: 'E0D8CC' })] }),
        ],
      }),
    ]})],
  }),
  spacer(),
  infoBox('Informasi Dokumen', [
    ['Versi', '1.0'],
    ['Tanggal', '17 Juni 2026'],
    ['Sistem', 'Amazing Toys Hybrid (SOS x Odoo 18)'],
    ['Stack', 'Node.js / Express · React 18 · PostgreSQL 15 · Docker'],
    ['Mode Order', 'HELPER_INPUT | SELF_ORDER | HELPER_APPROVE'],
  ]),
  spacer(),

  // ── TOC ───────────────────────────────────────────────────────────────────
  new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  heading1('1. Gambaran Umum Sistem'),
  divider(),
  para('Amazing Toys Fair 2026 adalah sistem manajemen booth pameran mainan hybrid yang mengintegrasikan antrian order fisik dengan backend Odoo 18 untuk pencatatan akuntansi. Sistem ini berjalan di 5 container Docker dan mendukung tiga mode operasi:'),
  spacer(),
  infoBox('Mode Operasi', [
    ['SELF_ORDER', 'Customer menelusuri katalog dan membuat order sendiri (mode legacy)'],
    ['HELPER_INPUT', 'Helper booth memasukkan order atas nama customer (default CR-035)'],
    ['HELPER_APPROVE', 'Order masuk sebagai PENDING_APPROVAL dan perlu disetujui helper (CR-040)'],
  ]),
  spacer(),
  para('Terdapat 6 role utama dalam sistem:', { bold: true }),
  spacer(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1400, 2200, 5760],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 1400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Role', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 2200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Nama', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 5760, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Tanggung Jawab Utama', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
      ]}),
      ...([
        ['CUSTOMER', 'Pengunjung / Pembeli', 'Browse produk, buat order, pantau status, ambil nota'],
        ['HELPER', 'Petugas Booth', 'Input order untuk customer, approval order, serah terima barang'],
        ['CASHIER', 'Kasir', 'Proses pembayaran, POS langsung, cetak struk'],
        ['TENANT', 'Operator Booth', 'Monitor penjualan dan stok booth sendiri'],
        ['LEADER', 'Pimpinan / Manajer', 'Dashboard KPI, laporan omset, manajemen performa'],
        ['ADMIN', 'Administrator', 'Konfigurasi sistem, master data, user management, integrasi'],
      ].map(([role, nama, tanggung], i) =>
        new TableRow({ children: [
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'F5F0E8' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 1400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: role, bold: true, font: 'Arial', size: 20, color: COLORS.navy })] })] }),
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'F5F0E8' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 2200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: nama, font: 'Arial', size: 20 })] })] }),
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'F5F0E8' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 5760, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: tanggung, font: 'Arial', size: 20 })] })] }),
        ]})
      )),
    ],
  }),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CUSTOMER
  // ═══════════════════════════════════════════════════════════════════════════
  roleHeaderTable('CUSTOMER', 'Role: Customer / Pengunjung', 'Pengunjung pameran yang browse, order, dan memantau status pembelian', COLORS.teal),
  spacer(),
  heading2('2.1 Login & Registrasi'),
  para('Customer menggunakan halaman login khusus yang terpisah dari staff. Terdapat pilihan login dengan akun yang sudah ada atau registrasi baru.'),
  spacer(),
  stepTable([
    [1, 'Buka Halaman Login', 'Navigasi ke URL sistem, lalu pilih "Login Customer"'],
    [2, 'Registrasi (baru)', 'Klik "Daftar" — isi nama, nomor HP, email, dan buat password'],
    [3, 'Verifikasi OTP', 'Masukkan kode OTP yang dikirim via WhatsApp ke nomor HP'],
    [4, 'Login', 'Masukkan nomor HP / email dan password, lalu klik Login'],
  ]),
  spacer(),
  heading2('2.2 Browse Katalog Produk'),
  para('Halaman utama customer setelah login adalah katalog produk. Tersedia tiga mode tampilan:'),
  spacer(),
  infoBox('Mode Tampilan Katalog', [
    ['Mode Produk', 'Semua produk ditampilkan dalam grid, bisa difilter per kategori'],
    ['Mode Toko', 'Pilih booth/tenant terlebih dahulu, lalu lihat produk dari booth tersebut'],
    ['Mode Wishlist', 'Tampilkan hanya produk yang sudah di-bookmark sebagai favorit'],
  ]),
  spacer(),
  para('Fitur pada halaman Browse:', { bold: true }),
  bullet('Search bar — cari produk berdasarkan nama'),
  bullet('Tombol QR Scanner — scan barcode produk untuk langsung ke detail'),
  bullet('Filter Kategori — chip horizontal untuk memfilter per kategori'),
  bullet('Filter Lantai (Mode Toko) — pilih lantai 1, 2, atau 3'),
  bullet('Grid Produk — klik kartu produk untuk melihat detail dalam bottom sheet'),
  bullet('Tombol Wishlist (hati) — simpan/hapus produk dari daftar favorit'),
  bullet('Tombol Keranjang — navigasi ke cart'),
  spacer(),
  heading2('2.3 Keranjang & Checkout'),
  stepTable([
    [1, 'Buka Cart', 'Klik ikon keranjang di pojok kanan atas halaman Browse'],
    [2, 'Review Item', 'Periksa daftar produk, ubah jumlah (+/-), atau hapus item'],
    [3, 'Masukkan Voucher', 'Opsional: ketik kode voucher diskon lalu klik "Terapkan"'],
    [4, 'Cek Total', 'Lihat rincian: subtotal, diskon, PPN, dan grand total'],
    [5, 'Checkout', 'Klik tombol "Checkout" — sistem membuat order dan nomor transaksi'],
    [6, 'Pantau Status', 'Redirect ke halaman tracking status order secara real-time'],
  ]),
  spacer(),
  para('Catatan penting:', { bold: true }),
  bullet('Terdapat batas maksimum item per order — sistem menampilkan peringatan jika melebihi batas'),
  bullet('Voucher memiliki scope per tenant — voucher dari tenant A tidak berlaku untuk produk tenant B'),
  spacer(),
  heading2('2.4 Tracking & Status Order'),
  para('Setelah checkout, customer dapat memantau progress order secara real-time:'),
  spacer(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 7160],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 2200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 7160, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Keterangan', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
      ]}),
      ...([
        ['PENDING', 'Order dibuat, menunggu diproses atau dibayar'],
        ['PENDING_APPROVAL', 'Order menunggu approval dari helper booth (mode HELPER_APPROVE)'],
        ['RESERVED', 'Stok sudah dipesan, menunggu pembayaran di kasir'],
        ['PAID', 'Pembayaran selesai, order sedang disiapkan oleh booth'],
        ['DONE', 'Barang sudah selesai disiapkan booth, menunggu serah terima'],
        ['COMPLETED', 'Serah terima selesai, order tuntas'],
        ['CANCELLED', 'Order dibatalkan'],
      ].map(([s, k], i) =>
        new TableRow({ children: [
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'F5F0E8' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 2200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: s, bold: true, font: 'Arial', size: 20, color: COLORS.navy })] })] }),
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'F5F0E8' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 7160, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: k, font: 'Arial', size: 20 })] })] }),
        ]})
      )),
    ],
  }),
  spacer(),
  heading2('2.5 Halaman Profil Customer'),
  para('Customer dapat mengelola akun melalui halaman Profil:'),
  bullet('Ubah nama dan informasi akun'),
  bullet('Lihat riwayat order lengkap'),
  bullet('Kelola perangkat tepercaya (Trusted Devices) untuk skip OTP'),
  bullet('Konfirmasi pengambilan barang (Receipt Pickup)'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. HELPER
  // ═══════════════════════════════════════════════════════════════════════════
  roleHeaderTable('HELPER', 'Role: Helper / Petugas Booth', 'Petugas yang membantu customer order, mengelola approval, dan serah terima barang', COLORS.olive),
  spacer(),
  heading2('3.1 Login Helper'),
  para('Helper termasuk kategori "Staff" dan menggunakan halaman Login Staff. Proses login menggunakan username + password dengan verifikasi OTP (kecuali perangkat tepercaya).'),
  spacer(),
  stepTable([
    [1, 'Buka Login Staff', 'Navigasi ke /login-staff'],
    [2, 'Input Kredensial', 'Masukkan username dan password'],
    [3, 'Verifikasi OTP', 'Masukkan OTP dari WhatsApp (kecuali perangkat sudah ditandai trusted)'],
    [4, 'Dashboard Helper', 'Langsung diarahkan ke halaman Helper dengan sidebar menu'],
  ]),
  spacer(),
  heading2('3.2 Sidebar Menu Helper'),
  para('Helper memiliki sidebar kiri dengan menu utama:'),
  spacer(),
  infoBox('Menu Sidebar', [
    ['Buat Order > Membuat Order', 'Form input order baru untuk customer di booth'],
    ['Buat Order > Outstanding', 'Daftar order yang belum selesai/dibayar'],
    ['Buat Order > Paid', 'Daftar order yang sudah dibayar'],
    ['Approval > Belum Approve', 'Antrian order yang menunggu persetujuan helper (mode HELPER_APPROVE)'],
    ['Approval > Sudah Approve', 'Daftar order yang sudah disetujui'],
    ['Approval > Approval Pre-Order', 'Antrian pre-order yang membutuhkan persetujuan'],
    ['History', 'Riwayat semua order yang pernah diproses'],
    ['Serah Terima', 'Proses handover barang ke customer'],
  ]),
  spacer(),
  heading2('3.3 Membuat Order (Mode HELPER_INPUT)'),
  stepTable([
    [1, 'Scan / Cari Customer', 'Scan QR kartu customer atau ketik nomor HP untuk identifikasi'],
    [2, 'Pilih Produk', 'Browse produk booth, klik produk untuk menambah ke order'],
    [3, 'Atur Kuantitas', 'Gunakan +/- untuk mengatur jumlah tiap produk'],
    [4, 'Input Voucher', 'Opsional: masukkan kode voucher diskon'],
    [5, 'Submit Order', 'Klik "Buat Order" — sistem membuat order dengan status RESERVED'],
    [6, 'Konfirmasi', 'Halaman sukses tampil dengan nomor order, customer bisa langsung ke kasir'],
  ]),
  spacer(),
  heading2('3.4 Approval Queue (Mode HELPER_APPROVE)'),
  para('Pada mode HELPER_APPROVE, setiap order masuk sebagai PENDING_APPROVAL dan perlu disetujui oleh helper:'),
  bullet('Tab "Belum Approve": daftar order dengan status PENDING_APPROVAL'),
  bullet('Per item dapat disetujui atau ditolak secara individual'),
  bullet('Setelah semua item di-review, klik "Submit Approval"'),
  bullet('Order yang disetujui berubah ke status RESERVED'),
  bullet('Order yang ditolak dapat dibatalkan atau direvisi'),
  spacer(),
  heading2('3.5 Serah Terima Barang'),
  stepTable([
    [1, 'Menu Serah Terima', 'Klik menu "Serah Terima" di sidebar'],
    [2, 'Pilih Order', 'Lihat daftar order berstatus DONE yang siap diserahkan'],
    [3, 'Verifikasi Customer', 'Scan QR struk customer atau input kode konfirmasi'],
    [4, 'Selesaikan Serah Terima', 'Klik "Serah Terima" — status berubah ke COMPLETED'],
  ]),
  spacer(),
  heading2('3.6 Toggle Pre-Order Produk'),
  para('Helper dapat mengaktifkan/menonaktifkan status pre-order pada produk booth melalui menu khusus. Produk pre-order menampilkan badge khusus di katalog customer.'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CASHIER
  // ═══════════════════════════════════════════════════════════════════════════
  roleHeaderTable('CASHIER', 'Role: Kasir / Cashier', 'Petugas kasir yang memproses pembayaran, membuat order walk-in, dan mencetak struk', COLORS.red),
  spacer(),
  heading2('4.1 Dashboard Kasir'),
  para('Halaman pertama kasir setelah login menampilkan dua opsi utama dan riwayat transaksi terkini:'),
  spacer(),
  infoBox('Elemen Dashboard', [
    ['Cari Transaksi', 'Input nomor transaksi untuk langsung ke halaman pembayaran'],
    ['Tombol POS', 'Buka Point-of-Sale untuk membuat order baru tanpa customer browsing'],
    ['Riwayat Transaksi', 'Daftar transaksi terbaru: ID, nama customer, tanggal, jumlah, status'],
  ]),
  spacer(),
  heading2('4.2 Point-of-Sale (POS)'),
  para('POS memungkinkan kasir membuat order walk-in secara langsung tanpa perlu customer melalui proses browse di aplikasi:'),
  spacer(),
  stepTable([
    [1, 'Buka POS', 'Klik tombol "POS" di dashboard kasir'],
    [2, 'Identifikasi Customer (opsional)', 'Tab QR: scan kartu customer; Tab HP: ketik nomor telepon'],
    [3, 'Cari Produk', 'Gunakan search bar atau scroll grid produk'],
    [4, 'Tambah ke Keranjang', 'Klik produk atau klik tombol + pada kartu produk'],
    [5, 'Review Keranjang', 'Panel kanan menampilkan ringkasan order dan total'],
    [6, 'Input Voucher', 'Opsional: masukkan kode voucher di field voucher'],
    [7, 'Buat Order', 'Klik "Buat Order" — dapatkan nomor transaksi'],
    [8, 'Proses Pembayaran', 'Otomatis redirect ke halaman Payment dengan transaksi tersebut'],
  ]),
  spacer(),
  para('Informasi stok ditampilkan pada setiap kartu produk. Indikator stok menampilkan:'),
  bullet('Stok normal — tersedia (hijau)'),
  bullet('Stok rendah — peringatan (kuning/oranye)'),
  bullet('Habis — tidak dapat dipilih (merah/abu-abu)'),
  spacer(),
  heading2('4.3 Proses Pembayaran'),
  para('Halaman pembayaran menampilkan detail lengkap transaksi dan form pembayaran:'),
  spacer(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: border(COLORS.red), shading: { fill: COLORS.red, type: ShadingType.CLEAR }, width: { size: 2400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Metode Bayar', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
        new TableCell({ borders: border(COLORS.red), shading: { fill: COLORS.red, type: ShadingType.CLEAR }, width: { size: 6960, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Keterangan & Field yang Diisi', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
      ]}),
      ...([
        ['CASH', 'Input jumlah uang yang diterima — sistem otomatis hitung kembalian'],
        ['QRIS', 'Scan QR payment — input nomor referensi setelah transfer'],
        ['EDC', 'Gesek kartu — input nomor referensi EDC'],
        ['TRANSFER', 'Transfer bank — input nomor referensi transfer'],
      ].map(([m, k], i) =>
        new TableRow({ children: [
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'FEF0F0' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 2400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: m, bold: true, font: 'Arial', size: 20 })] })] }),
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'FEF0F0' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 6960, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: k, font: 'Arial', size: 20 })] })] }),
        ]})
      )),
    ],
  }),
  spacer(),
  stepTable([
    [1, 'Pilih Metode Bayar', 'Klik tombol metode pembayaran yang diinginkan'],
    [2, 'Tambah Produk (opsional)', 'Jika transaksi masih PENDING, panel kanan menampilkan browser produk untuk menambah item'],
    [3, 'Input Jumlah/Referensi', 'CASH: ketik nominal diterima; non-cash: ketik nomor referensi'],
    [4, 'Proses Pembayaran', 'Klik "Proses Pembayaran" — status berubah ke PAID'],
    [5, 'Layar Konfirmasi', 'Tampil detail transaksi, kembalian (CASH), dan opsi cetak struk'],
    [6, 'Cetak Struk', 'Klik "Cetak Struk" untuk membuka dialog cetak struk'],
  ]),
  spacer(),
  heading2('4.4 Group Payment'),
  para('Fitur Group Payment memungkinkan penggabungan beberapa transaksi dari customer yang sama menjadi satu pembayaran:'),
  bullet('Cari transaksi customer berdasarkan nama atau ID'),
  bullet('Centang transaksi-transaksi yang akan digabung'),
  bullet('Klik "Merge & Bayar" untuk membuat satu transaksi gabungan'),
  bullet('Proses pembayaran dilakukan sekali untuk semua transaksi yang digabung'),
  spacer(),
  heading2('4.5 Rekap Kasir'),
  para('Laporan rekap transaksi kasir harian tersedia di menu Rekap. Menampilkan total per metode pembayaran dan daftar semua transaksi shift tersebut.'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. TENANT
  // ═══════════════════════════════════════════════════════════════════════════
  roleHeaderTable('TENANT', 'Role: Tenant / Operator Booth', 'Operator booth yang memantau performa penjualan dan stok booth sendiri', COLORS.olive),
  spacer(),
  heading2('5.1 Dashboard Tenant'),
  para('Dashboard utama tenant menampilkan performa booth pada tanggal yang dipilih:'),
  spacer(),
  infoBox('Kartu Metrik Dashboard', [
    ['Revenue Hari Ini', 'Total omset dalam rupiah (kartu besar, double-width)'],
    ['Jumlah Order', 'Total order yang masuk pada tanggal tersebut'],
    ['Item Done', 'Jumlah item yang sudah selesai disiapkan'],
    ['Item Pending', 'Jumlah item yang masih dalam proses'],
  ]),
  spacer(),
  para('Filter tanggal tersedia di bagian atas dashboard. Sistem menggunakan timezone WIB (Asia/Jakarta) untuk menghindari mismatch tanggal.'),
  spacer(),
  heading2('5.2 Produk Terlaris'),
  para('Di bawah kartu metrik, terdapat tabel Produk Terlaris yang menampilkan:'),
  bullet('Nama produk'),
  bullet('Jumlah unit terjual pada tanggal tersebut'),
  bullet('Diurutkan dari yang paling banyak terjual'),
  spacer(),
  heading2('5.3 Daftar Order Booth'),
  para('Menu "Orders" menampilkan semua order yang mengandung produk dari booth tenant tersebut:'),
  bullet('Filter berdasarkan status: PENDING, RESERVED, PAID, DONE, COMPLETED'),
  bullet('Lihat detail item per order'),
  bullet('Tandai item sebagai DONE ketika sudah siap diserahkan'),
  spacer(),
  heading2('5.4 Laporan Harian'),
  para('Halaman Laporan Harian (LaporanHarianPage) menyediakan rekap detail per hari:'),
  bullet('Ringkasan omset per tanggal'),
  bullet('Breakdown per produk: unit terjual dan nilai'),
  bullet('Export data untuk keperluan pelaporan'),
  spacer(),
  heading2('5.5 Laporan Stok'),
  para('Halaman Stok Report menampilkan kondisi stok terkini:'),
  bullet('Daftar semua produk booth dengan stok saat ini'),
  bullet('Indikator stok rendah'),
  bullet('Perbandingan stok awal vs stok terpakai'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. LEADER
  // ═══════════════════════════════════════════════════════════════════════════
  roleHeaderTable('LEADER', 'Role: Leader / Pimpinan Event', 'Manajemen yang memantau KPI event secara keseluruhan dan mengelola laporan keuangan', COLORS.navy),
  spacer(),
  heading2('6.1 Dashboard KPI'),
  para('Dashboard utama leader menampilkan metrik event secara real-time:'),
  spacer(),
  infoBox('Kartu KPI', [
    ['Total Revenue', 'Omset keseluruhan event pada tanggal yang dipilih'],
    ['Transaksi Selesai', 'Jumlah transaksi dengan status COMPLETED atau PAID'],
    ['Transaksi Pending', 'Jumlah transaksi yang belum diselesaikan'],
    ['Pengunjung Unik', 'Jumlah customer unik yang melakukan transaksi'],
  ]),
  spacer(),
  para('Visualisasi tambahan di bawah KPI cards:'),
  bullet('Bar chart metode pembayaran: perbandingan CASH vs QRIS vs EDC vs TRANSFER'),
  bullet('Tabel Top Tenant: ranking booth berdasarkan revenue hari tersebut'),
  spacer(),
  heading2('6.2 Menu Laporan Leader'),
  para('Leader memiliki akses ke berbagai halaman laporan:'),
  spacer(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 2800, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Halaman', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
        new TableCell({ borders: border(COLORS.navy), shading: { fill: COLORS.navy, type: ShadingType.CLEAR }, width: { size: 6560, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Konten', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
      ]}),
      ...([
        ['Sales Report', 'Laporan penjualan komprehensif dengan filter tanggal dan tenant'],
        ['Tax Report', 'Laporan PPN: total pajak yang terkumpul, breakdown per transaksi'],
        ['Voucher Report', 'Penggunaan voucher: jumlah pemakaian, nilai diskon yang diberikan'],
        ['Settlement', 'Rekap pembayaran untuk setiap booth/tenant, siap untuk settlement'],
        ['Top Products', 'Ranking produk paling banyak terjual di seluruh event'],
        ['Top Customers', 'Ranking customer berdasarkan nilai total pembelian'],
        ['Tenant Ranking', 'Peringkat booth berdasarkan omset, jumlah transaksi, dll.'],
        ['Visitor Stats', 'Statistik pengunjung: per jam, per hari, konversi ke pembeli'],
        ['Conversion', 'Analisis konversi dari browse ke order ke pembayaran'],
        ['Helper Performance', 'Performa petugas helper: jumlah order, approval rate, dll.'],
        ['Returns', 'Manajemen retur barang dan pembatalan order'],
      ].map(([h, k], i) =>
        new TableRow({ children: [
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'E8EDF5' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 2800, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: 'Arial', size: 20, color: COLORS.navy })] })] }),
          new TableCell({ borders: border(), shading: { fill: i % 2 === 0 ? 'E8EDF5' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 6560, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: k, font: 'Arial', size: 20 })] })] }),
        ]})
      )),
    ],
  }),
  spacer(),
  heading2('6.3 Delete Approval'),
  para('Beberapa operasi penghapusan data memerlukan persetujuan leader. Leader dapat menyetujui atau menolak permintaan penghapusan melalui halaman Leader Delete Approval.'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  roleHeaderTable('ADMIN', 'Role: Administrator Sistem', 'Kontrol penuh atas konfigurasi sistem, data master, user, dan integrasi', COLORS.purple),
  spacer(),
  para('Admin memiliki akses ke panel administrasi dengan 9 tab modul. Setiap tab terisolasi dengan error boundary sehingga error di satu tab tidak mempengaruhi tab lain.'),
  spacer(),

  heading2('7.1 Modul: Master Data'),
  para('Pengelolaan data produk untuk seluruh booth:'),
  bullet('Tambah, edit, hapus produk'),
  bullet('Upload gambar produk (max 800x800px, JPEG 80%, batas 5MB)'),
  bullet('Set harga, stok awal, kategori, dan booth pemilik produk'),
  bullet('Bulk upload produk via file Excel (halaman ProductBulkUpload)'),
  bullet('Toggle status pre-order per produk'),
  spacer(),

  heading2('7.2 Modul: User & Role'),
  para('Manajemen akun user dan hak akses:'),
  bullet('Buat akun baru untuk semua role (HELPER, CASHIER, TENANT, LEADER, ADMIN)'),
  bullet('Edit username, password, dan role user'),
  bullet('Assign user ke booth/tenant tertentu'),
  bullet('Aktifkan/nonaktifkan akun user'),
  bullet('Reset OTP dan trusted devices user'),
  spacer(),

  heading2('7.3 Modul: Booth Tenant'),
  para('Manajemen data booth/tenant peserta pameran:'),
  bullet('Tambah, edit, hapus data booth'),
  bullet('Atur nama booth, nomor booth, lantai, dan deskripsi'),
  bullet('Simpan kontak person penanggung jawab booth'),
  bullet('Aktifkan/nonaktifkan booth dari sistem'),
  spacer(),

  heading2('7.4 Modul: Konfigurasi'),
  para('Pengaturan operasional event:'),
  infoBox('Opsi Konfigurasi', [
    ['order_mode', 'Set mode order: SELF_ORDER | HELPER_INPUT | HELPER_APPROVE'],
    ['max_items_per_order', 'Batas maksimum item yang bisa diorder sekaligus'],
    ['timeout_minutes', 'Waktu timeout sebelum order PENDING otomatis dibatalkan'],
    ['event_name', 'Nama event yang tampil di header aplikasi'],
    ['Logo Aplikasi', 'Upload logo yang tampil di seluruh aplikasi'],
    ['Maintenance Mode', 'Aktifkan mode maintenance untuk menutup akses publik'],
  ]),
  spacer(),

  heading2('7.5 Modul: Voucher'),
  para('Pembuatan dan pengelolaan kode diskon:'),
  bullet('Buat voucher dengan kode unik'),
  bullet('Set nilai diskon (nominal atau persentase)'),
  bullet('Set masa berlaku voucher (tanggal mulai dan akhir)'),
  bullet('Set scope voucher: global (semua booth) atau per booth tertentu'),
  bullet('Set batas penggunaan maksimum per voucher'),
  bullet('Aktifkan/nonaktifkan voucher'),
  spacer(),

  heading2('7.6 Modul: Audit Log'),
  para('Monitoring aktivitas sistem untuk keamanan dan debugging:'),
  bullet('Log semua aksi penting: login, create order, payment, perubahan konfigurasi'),
  bullet('Filter berdasarkan user, tanggal, dan jenis aksi'),
  bullet('Lihat detail aksi termasuk IP address dan user agent'),
  spacer(),

  heading2('7.7 Modul: Integrasi'),
  para('Konfigurasi koneksi ke sistem eksternal:'),
  bullet('Odoo 18: URL, database, API key untuk sinkronisasi akuntansi'),
  bullet('Payment gateway: konfigurasi QRIS provider'),
  bullet('Test koneksi integrasi secara langsung dari panel'),
  spacer(),

  heading2('7.8 Modul: Pajak & SPT'),
  para('Pengaturan PPN dan pemetaan akun Odoo:'),
  bullet('Set persentase PPN (default 11%)'),
  bullet('Konfigurasi tax grid untuk pelaporan SPT'),
  bullet('Pemetaan akun Odoo untuk jurnal penjualan dan pajak'),
  spacer(),

  heading2('7.9 Modul: WA Gateway'),
  para('Konfigurasi layanan notifikasi WhatsApp (WAHA):'),
  bullet('URL WAHA server dan API key'),
  bullet('Nomor WhatsApp pengirim notifikasi'),
  bullet('Template pesan untuk: OTP, konfirmasi order, QR payment'),
  bullet('Test kirim pesan WhatsApp dari panel admin'),
  bullet('Status koneksi WA gateway secara real-time'),
  spacer(),

  heading2('7.10 Modul: Pre-Order Shipment'),
  para('Manajemen pengiriman barang pre-order setelah event:'),
  bullet('Lihat daftar semua produk pre-order yang sudah dibayar'),
  bullet('Update status pengiriman per order'),
  bullet('Input nomor resi dan kurir pengiriman'),
  bullet('Filter berdasarkan status pengiriman dan tenant'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. ALUR BISNIS
  // ═══════════════════════════════════════════════════════════════════════════
  heading1('8. Alur Bisnis & Skenario Umum'),
  divider(),
  spacer(),

  heading2('8.1 Skenario: Order Normal (Mode HELPER_INPUT)'),
  stepTable([
    [1, 'Customer Datang', 'Customer tiba di booth, helper menyambut dan menanyakan kebutuhan'],
    [2, 'Helper Input Order', 'Helper scan kartu customer (atau input HP), pilih produk, submit order'],
    [3, 'Status RESERVED', 'Sistem membuat order berstatus RESERVED, stok dikunci'],
    [4, 'Customer ke Kasir', 'Customer membawa nomor order ke kasir event'],
    [5, 'Kasir Proses Bayar', 'Kasir cari transaksi, pilih metode bayar, proses, cetak struk'],
    [6, 'Status PAID', 'Order berubah ke PAID, booth mendapat notifikasi untuk siapkan barang'],
    [7, 'Booth Siapkan', 'Booth menyiapkan barang dan menandai item sebagai DONE'],
    [8, 'Serah Terima', 'Helper scan struk customer, konfirmasi serah terima, status COMPLETED'],
  ]),
  spacer(),

  heading2('8.2 Skenario: Order Walk-in via POS Kasir'),
  stepTable([
    [1, 'Customer di Kasir', 'Customer langsung ke kasir tanpa melalui helper booth'],
    [2, 'Kasir Buka POS', 'Kasir klik tombol POS di dashboard'],
    [3, 'Input Identitas', 'Opsional: scan kartu atau input nomor HP customer'],
    [4, 'Pilih Produk', 'Kasir browse produk dan tambahkan ke cart POS'],
    [5, 'Buat & Bayar', 'Klik "Buat Order", lalu langsung proses pembayaran'],
    [6, 'Cetak Struk', 'Cetak struk untuk customer'],
    [7, 'Notif ke Booth', 'Booth mendapat notifikasi WebSocket untuk memproses order'],
  ]),
  spacer(),

  heading2('8.3 Skenario: Mode HELPER_APPROVE'),
  stepTable([
    [1, 'Customer Browse', 'Customer browse dan checkout sendiri via aplikasi mobile'],
    [2, 'Status PENDING_APPROVAL', 'Order masuk ke antrian approval helper booth'],
    [3, 'Helper Review', 'Helper membuka tab "Belum Approve", review per item'],
    [4, 'Approve/Reject Item', 'Helper centang setuju atau tolak untuk setiap item'],
    [5, 'Submit Approval', 'Helper submit — item yang disetujui menjadi RESERVED'],
    [6, 'Customer ke Kasir', 'Customer ke kasir untuk membayar'],
    [7, 'Proses Bayar', 'Sama seperti skenario normal (langkah 5-8 di atas)'],
  ]),
  spacer(),

  heading2('8.4 Skenario: Pre-Order'),
  para('Produk pre-order adalah produk yang stoknya belum tersedia saat event, dikirim ke customer setelah event:'),
  bullet('Helper toggle status pre-order produk via menu khusus'),
  bullet('Customer dapat order dan bayar produk pre-order seperti biasa'),
  bullet('Setelah event, Admin membuka halaman Pre-Order Shipment'),
  bullet('Admin input nomor resi dan update status pengiriman per order'),
  bullet('Customer menerima notifikasi WhatsApp saat barang dikirim'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. INTEGRASI & NOTIFIKASI
  // ═══════════════════════════════════════════════════════════════════════════
  heading1('9. Integrasi & Notifikasi'),
  divider(),
  spacer(),

  heading2('9.1 Notifikasi WhatsApp (WAHA)'),
  para('Sistem menggunakan WAHA (WhatsApp HTTP API) untuk notifikasi otomatis:'),
  spacer(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 6360],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: border(COLORS.olive), shading: { fill: COLORS.olive, type: ShadingType.CLEAR }, width: { size: 3000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Trigger', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
        new TableCell({ borders: border(COLORS.olive), shading: { fill: COLORS.olive, type: ShadingType.CLEAR }, width: { size: 6360, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Isi Notifikasi', bold: true, font: 'Arial', size: 20, color: COLORS.white })] })] }),
      ]}),
      ...([
        ['Login Staff (OTP)', 'Kode OTP 6 digit untuk verifikasi login staff'],
        ['Registrasi Customer (OTP)', 'Kode OTP untuk verifikasi nomor HP baru'],
        ['Order Dibuat', 'Konfirmasi order dengan nomor transaksi dan ringkasan item'],
        ['Pembayaran Berhasil', 'Struk digital dengan detail transaksi dan QR untuk serah terima'],
        ['Pre-Order Dikirim', 'Nomor resi dan informasi pengiriman'],
      ].map(([t, i], idx) =>
        new TableRow({ children: [
          new TableCell({ borders: border(), shading: { fill: idx % 2 === 0 ? 'E8EDD0' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 3000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: t, font: 'Arial', size: 20 })] })] }),
          new TableCell({ borders: border(), shading: { fill: idx % 2 === 0 ? 'E8EDD0' : COLORS.white, type: ShadingType.CLEAR }, width: { size: 6360, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: i, font: 'Arial', size: 20 })] })] }),
        ]})
      )),
    ],
  }),
  spacer(),

  heading2('9.2 Sinkronisasi Odoo 18'),
  para('Transaksi yang selesai (status PAID/COMPLETED) disinkronkan ke Odoo 18 untuk pencatatan akuntansi:'),
  bullet('Setiap transaksi dibuat sebagai Sales Order di Odoo'),
  bullet('Invoice otomatis dibuat dan dikonfirmasi'),
  bullet('Jurnal pembayaran disesuaikan dengan metode bayar (CASH/QRIS/EDC/TRANSFER)'),
  bullet('PPN dihitung dan diposting ke akun pajak yang dikonfigurasi di panel Admin'),
  bullet('Status sinkronisasi dapat dicek di modul Integrasi panel Admin'),
  spacer(),

  heading2('9.3 Real-time Update via WebSocket'),
  para('Sistem menggunakan WebSocket untuk update real-time antar role:'),
  bullet('Saat kasir memproses pembayaran — booth menerima notifikasi untuk memproses order'),
  bullet('Saat booth menandai item DONE — customer menerima update di halaman tracking'),
  bullet('Saat helper submit approval — counter badge approval diperbarui'),
  bullet('Saat ada order baru masuk — helper melihat badge antrian bertambah'),
  pageBreak(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TIPS & TROUBLESHOOTING
  // ═══════════════════════════════════════════════════════════════════════════
  heading1('10. Tips & Troubleshooting'),
  divider(),
  spacer(),

  heading2('10.1 Tips Operasional'),
  bullet('Selalu refresh halaman jika badge notifikasi tidak update dalam 1 menit'),
  bullet('Gunakan fitur Trusted Device untuk skip OTP di perangkat kasir yang tetap'),
  bullet('Kasir: gunakan POS untuk order walk-in, bukan meminta customer browse sendiri'),
  bullet('Helper: pastikan scan kartu customer sebelum input order agar data terhubung ke akun customer'),
  bullet('Admin: backup konfigurasi sebelum mengubah order_mode di saat event berlangsung'),
  spacer(),

  heading2('10.2 Masalah Umum'),
  spacer(),
  infoBox('Troubleshooting', [
    ['OTP tidak masuk', 'Cek koneksi WAHA di Admin > WA Gateway. Pastikan nomor WA gateway aktif.'],
    ['Order stuck RESERVED', 'Kemungkinan timeout habis. Admin dapat extend timeout atau batalkan manual.'],
    ['Produk tidak muncul', 'Cek apakah produk aktif dan stok > 0 di Master Data.'],
    ['Integrasi Odoo gagal', 'Cek kredensial di Admin > Integrasi. Gunakan tombol "Test Koneksi".'],
    ['Halaman Maintenance', 'Admin mematikan maintenance mode di Admin > Konfigurasi.'],
    ['Group payment gagal', 'Pastikan semua transaksi yang digabung milik customer yang sama dan belum PAID.'],
  ]),
  spacer(),

  heading2('10.3 Kontak & Dukungan'),
  para('Untuk permasalahan teknis yang tidak dapat diselesaikan melalui panel Admin, hubungi tim technical:'),
  bullet('Cek log aplikasi di container hybrid_backend untuk error backend'),
  bullet('Cek browser console untuk error frontend'),
  bullet('Gunakan halaman Audit Log untuk menelusuri aksi yang tidak sesuai'),
  spacer(),
  divider(),
  spacer(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [new TextRun({ text: 'Amazing Toys Fair 2026 — Panduan Sistem', font: 'Arial', size: 20, color: COLORS.gray, italic: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Dokumen ini bersifat internal dan dikompilasi pada 17 Juni 2026', font: 'Arial', size: 18, color: COLORS.gray, italic: true })],
  }),
];

// ─── Document ────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: COLORS.navy },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: COLORS.navy },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: COLORS.gray },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.navy, space: 1 } },
          children: [
            new TextRun({ text: 'Amazing Toys Fair 2026', font: 'Arial', size: 18, color: COLORS.navy, bold: true }),
            new TextRun({ text: '  —  Panduan Sistem', font: 'Arial', size: 18, color: COLORS.gray }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.navy, space: 1 } },
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'Halaman ', font: 'Arial', size: 18, color: COLORS.gray }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: COLORS.gray }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Amazing_Toys_Tour_Guide.docx', buf);
  console.log('OK: Amazing_Toys_Tour_Guide.docx');
});
