'use strict';

/**
 * bulkImageUpload.controller.js
 *
 * POST /api/v1/admin/products/bulk-upload-images
 * Accepts a .zip file containing:
 *   - mapping.xlsx  (columns: barcode, filename) — primary
 *   - mapping.csv   (columns: barcode,filename)  — fallback
 *   - image files   (jpg/jpeg/png/webp/gif)
 *
 * For each row in mapping file:
 *   1. Find product by barcode
 *   2. Save image to public/uploads/products/
 *   3. Update image_url in products table
 *
 * Returns: { updated, notFound, errors, skipped }
 */

const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const unzipper = require('unzipper');
const ExcelJS  = require('exceljs');
const { parse: csvParse } = require('@fast-csv/parse');
const sharp    = require('sharp');
const { query } = require('../../config/database');

const UPLOADS_DIR    = path.join(__dirname, '../../../public/uploads/products');
const ALLOWED_EXT    = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_IMG_BYTES  = 5 * 1024 * 1024; // 5 MB per image after processing
const MAX_ZIP_BYTES  = 100 * 1024 * 1024; // 100 MB zip

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_ZIP_BYTES },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file .zip yang diperbolehkan.'));
    }
  },
}).single('zipFile');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Parse mapping.xlsx dari buffer.
 * Kolom wajib: barcode, filename (header di baris pertama, case-insensitive).
 * @returns {Promise<Array<{barcode: string, filename: string}>>}
 */
async function parseMappingExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel tidak memiliki sheet.');

  // Cari index kolom barcode & filename dari baris header (row 1)
  let barcodeCol = -1;
  let filenameCol = -1;
  ws.getRow(1).eachCell((cell, colNum) => {
    const val = String(cell.value || '').trim().toLowerCase();
    if (val === 'barcode')  barcodeCol  = colNum;
    if (val === 'filename') filenameCol = colNum;
  });

  if (barcodeCol === -1 || filenameCol === -1) {
    throw new Error('Kolom "barcode" dan "filename" wajib ada di baris pertama mapping.xlsx.');
  }

  const rows = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // skip header
    const barcode  = String(row.getCell(barcodeCol).value  ?? '').trim();
    const filename = String(row.getCell(filenameCol).value ?? '').trim();
    if (barcode && filename) rows.push({ barcode, filename });
  });

  return rows;
}

/**
 * Parse mapping.csv dari buffer (fallback jika tidak ada .xlsx).
 * @returns {Promise<Array<{barcode: string, filename: string}>>}
 */
function parseMappingCsv(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = require('stream');
    const readable = new stream.PassThrough();
    readable.end(buffer);

    readable
      .pipe(csvParse({ headers: true, trim: true, skipEmptyLines: true }))
      .on('data', row => {
        const barcode  = (row.barcode  || '').trim();
        const filename = (row.filename || '').trim();
        if (barcode && filename) rows.push({ barcode, filename });
      })
      .on('end',   () => resolve(rows))
      .on('error', reject);
  });
}

/**
 * Main handler.
 */
async function bulkUploadImages(req, res, next) {
  // multer parses the multipart — errors surface via next()
  await new Promise((resolve, reject) => {
    upload(req, res, err => (err ? reject(err) : resolve()));
  }).catch(err => {
    return res.status(400).json({ success: false, message: err.message });
  });

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Field zipFile wajib diisi.' });
  }

  try {
    ensureUploadsDir();

    // ── 1. Extract ZIP into memory maps ─────────────────────────────────────
    const zipBuffer   = req.file.buffer;
    let   xlsxBuf     = null;
    let   csvBuf      = null;
    const imageMap    = new Map(); // filename.lower → entry (lazy)

    const directory = await unzipper.Open.buffer(zipBuffer);

    for (const entry of directory.files) {
      if (entry.type !== 'File') continue;

      const baseName = path.basename(entry.path);
      const lower    = baseName.toLowerCase();

      if (lower === 'mapping.xlsx') { xlsxBuf = await entry.buffer(); continue; }
      if (lower === 'mapping.csv')  { csvBuf  = await entry.buffer(); continue; }

      const ext = path.extname(lower);
      if (ALLOWED_EXT.has(ext)) {
        imageMap.set(lower, entry);
      }
    }

    if (!xlsxBuf && !csvBuf) {
      return res.status(400).json({
        success: false,
        message: 'File mapping.xlsx (atau mapping.csv) tidak ditemukan di dalam ZIP.',
      });
    }

    // ── 2. Parse mapping file (xlsx lebih diprioritaskan) ────────────────────
    let mappingRows;
    try {
      mappingRows = xlsxBuf
        ? await parseMappingExcel(xlsxBuf)
        : await parseMappingCsv(csvBuf);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: parseErr.message });
    }

    if (mappingRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mapping file kosong atau tidak memiliki baris data (kolom wajib: barcode, filename).',
      });
    }

    // Duplicate barcode check in mapping
    const barcodesSeen = new Set();
    for (const r of mappingRows) {
      if (barcodesSeen.has(r.barcode)) {
        return res.status(400).json({
          success: false,
          message: `Barcode duplikat di mapping file: "${r.barcode}"`,
        });
      }
      barcodesSeen.add(r.barcode);
    }

    // ── 3. Process each row ──────────────────────────────────────────────────
    const updated  = [];
    const notFound = []; // barcode tidak ada di DB
    const errors   = []; // masalah teknis per baris
    const skipped  = []; // file tidak ditemukan di ZIP

    for (const { barcode, filename } of mappingRows) {
      // Lookup product by barcode
      const prodRes = await query(
        'SELECT product_id FROM products WHERE barcode = $1',
        [barcode]
      );

      if (prodRes.rows.length === 0) {
        notFound.push(barcode);
        continue;
      }

      const productId = prodRes.rows[0].product_id;
      const fileKey   = filename.toLowerCase();
      const entry     = imageMap.get(fileKey);

      if (!entry) {
        skipped.push({ barcode, filename, reason: 'file tidak ada di ZIP' });
        continue;
      }

      try {
        const rawBuffer = await entry.buffer();

        // Resize & convert to webp for storage efficiency
        const processed = await sharp(rawBuffer)
          .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();

        if (processed.length > MAX_IMG_BYTES) {
          errors.push({ barcode, filename, reason: 'Ukuran gambar terlalu besar setelah kompresi (> 5 MB)' });
          continue;
        }

        // Save file: {timestamp}-{productId}.webp
        const outFilename = `${Date.now()}-${productId.replace(/[^a-zA-Z0-9]/g, '')}.webp`;
        const outPath     = path.join(UPLOADS_DIR, outFilename);
        fs.writeFileSync(outPath, processed);

        const imageUrl = `/uploads/products/${outFilename}`;

        await query(
          'UPDATE products SET image_url = $1, updated_at = NOW() WHERE product_id = $2',
          [imageUrl, productId]
        );

        updated.push({ barcode, product_id: productId, image_url: imageUrl });
      } catch (imgErr) {
        errors.push({ barcode, filename, reason: imgErr.message });
      }
    }

    res.json({
      success: true,
      summary: {
        total:     mappingRows.length,
        updated:   updated.length,
        not_found: notFound.length,
        skipped:   skipped.length,
        errors:    errors.length,
      },
      details: { updated, notFound, skipped, errors },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkUploadImages };
