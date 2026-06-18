'use strict';

/**
 * generate-sample-image-zip.js
 *
 * Generates sample_images_upload.zip containing:
 *   - mapping.xlsx  (Excel with barcode + filename columns)
 *   - 5 placeholder product images (colored squares)
 *
 * Usage: node scripts/generate-sample-image-zip.js
 */

const path     = require('path');
const fs       = require('fs');
const sharp    = require('sharp');
const archiver = require('archiver');
const ExcelJS  = require('exceljs');

const OUT_FILE = path.join(__dirname, '../sample_images_upload.zip');

// Sample products — replace barcodes with real ones from your DB
// (export from Master Data → Excel, ambil kolom Barcode)
const SAMPLES = [
  { barcode: '8991234567890', filename: '8991234567890.jpg', label: 'Produk A', color: { r: 59,  g: 130, b: 246 } },
  { barcode: '8991234567891', filename: 'gundam-rx78.jpg',   label: 'Produk B', color: { r: 16,  g: 185, b: 129 } },
  { barcode: '8991234567892', filename: 'tomica-red.jpg',    label: 'Produk C', color: { r: 239, g: 68,  b: 68  } },
  { barcode: '8991234567893', filename: 'lego-city.jpg',     label: 'Produk D', color: { r: 245, g: 158, b: 11  } },
  { barcode: '8991234567894', filename: 'barbie-dh.jpg',     label: 'Produk E', color: { r: 168, g: 85,  b: 247 } },
];

async function makeImage(label, color) {
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="rgb(${color.r},${color.g},${color.b})"/>
      <rect x="20" y="20" width="360" height="360" rx="16" fill="rgba(255,255,255,0.12)"/>
      <text x="200" y="185" font-family="Arial, sans-serif" font-size="36"
            font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">🧸</text>
      <text x="200" y="240" font-family="Arial, sans-serif" font-size="22"
            font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text>
      <text x="200" y="275" font-family="Arial, sans-serif" font-size="13"
            fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">Sample Image</text>
    </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function buildMappingExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Amazing Toys SOS';

  const ws = wb.addWorksheet('Mapping Gambar', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'barcode',  key: 'barcode',  width: 22 },
    { header: 'filename', key: 'filename', width: 30 },
  ];

  // Header style — consistent dengan pola export master data
  const headerRow = ws.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height    = 22;

  for (const s of SAMPLES) {
    ws.addRow({ barcode: s.barcode, filename: s.filename });
  }

  // Auto-filter
  ws.autoFilter = { from: 'A1', to: 'B1' };

  return wb.xlsx.writeBuffer();
}

async function main() {
  console.log('Generating sample_images_upload.zip...\n');

  const output  = fs.createWriteStream(OUT_FILE);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(output);

  // ── mapping.xlsx ───────────────────────────────────────────────────────────
  const xlsxBuf = await buildMappingExcel();
  archive.append(xlsxBuf, { name: 'mapping.xlsx' });
  console.log('  + mapping.xlsx');

  // ── images ─────────────────────────────────────────────────────────────────
  for (const s of SAMPLES) {
    const imgBuf = await makeImage(s.label, s.color);
    archive.append(imgBuf, { name: s.filename });
    console.log(`  + ${s.filename}`);
  }

  await archive.finalize();
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });

  const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`\nDone! → ${OUT_FILE} (${sizeKb} KB)`);

  console.log('\nIsi mapping.xlsx:');
  console.log('barcode          | filename');
  console.log('-'.repeat(50));
  for (const s of SAMPLES) {
    console.log(`${s.barcode.padEnd(17)}| ${s.filename}`);
  }

  console.log('\nTips: Ganti kolom "barcode" dengan barcode produk nyata dari export Master Data Excel.');
}

main().catch(err => { console.error(err); process.exit(1); });
