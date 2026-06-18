/**
 * ProductBulkUpload.jsx
 *
 * Admin bulk-upload produk master data — simplified 9-column template:
 *   product_id | barcode | product_name | category | price
 *   tenant | stock_quantity | odoo_categ_name | description
 *
 * Behavior: PARTIAL UPLOAD
 *   - Baris valid   → diupload ke server
 *   - Baris invalid → ditampilkan terpisah + bisa di-download ulang (Excel)
 *
 * Accepts `onBack` callback dari MasterDataTab.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Button from '../../components/ui/Button';
import ToastContainer from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { bulkUploadProducts, getAdminTenants } from '../../api/admin';

// ── Column definitions ────────────────────────────────────────────────────────

const HEADERS = [
  'product_id',
  'barcode',
  'product_name',
  'category',
  'price',
  'tenant',
  'stock_quantity',
  'odoo_categ_name',
  'description',
];

const REQUIRED_FIELDS = ['barcode', 'product_name', 'category', 'price', 'tenant'];

const FIELD_LABELS = {
  product_id:       'Product ID',
  barcode:          'Barcode',
  product_name:     'Nama Produk',
  category:         'Kategori',
  price:            'Harga (Rp)',
  tenant:           'Nama Booth / Tenant',
  stock_quantity:   'Stok',
  odoo_categ_name:  'Kategori Odoo',
  description:      'Deskripsi',
};

const FIELD_DESCS = {
  product_id:       'Opsional — kosongkan untuk auto-generate',
  barcode:          '** WAJIB — Barcode EAN-13 atau Code128',
  product_name:     '** WAJIB — Nama produk',
  category:         '** WAJIB — Kategori (cth: Action Figure)',
  price:            '** WAJIB — Harga angka (cth: 420000)',
  tenant:           '** WAJIB — Nama Booth / Tenant persis seperti di sistem',
  stock_quantity:   'Opsional — jumlah stok awal (default 0)',
  odoo_categ_name:  'Opsional — nama kategori Odoo',
  description:      'Opsional — deskripsi produk',
};

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRupiah(val) {
  const n = parseFloat(val);
  return isNaN(n) ? val : `Rp ${n.toLocaleString('id-ID')}`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return [];

  // Match header row case-insensitively
  const headerRow = raw[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
  const colMap    = {};
  HEADERS.forEach(h => {
    const idx = headerRow.indexOf(h);
    if (idx !== -1) colMap[h] = idx;
  });

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    if (cells.every(c => c === '' || c == null)) continue;

    const row = { _rowIndex: i + 1 }; // Excel row number (1=header)
    for (const field of HEADERS) {
      const ci   = colMap[field];
      row[field] = ci !== undefined ? String(cells[ci] ?? '').trim() : '';
    }
    rows.push(row);
  }
  return rows;
}

// ── Client-side validation ────────────────────────────────────────────────────

function validateRow(row, tenantNames, barcodesInBatch) {
  const errors = [];

  for (const f of REQUIRED_FIELDS) {
    if (!row[f] || String(row[f]).trim() === '') {
      errors.push({ field: f, message: `${FIELD_LABELS[f]} wajib diisi` });
    }
  }

  if (row.price) {
    const p = parseFloat(row.price);
    if (isNaN(p) || p < 0) errors.push({ field: 'price', message: 'Harga harus angka ≥ 0' });
  }

  // Tenant name validation (client-side hint)
  if (row.tenant && tenantNames.size > 0 &&
      !tenantNames.has(row.tenant.trim().toLowerCase())) {
    errors.push({ field: 'tenant', message: `"${row.tenant}" tidak ditemukan di sistem` });
  }

  // Duplicate barcode in batch
  const bc = (row.barcode || '').trim();
  if (bc && barcodesInBatch.filter(b => b === bc).length > 1) {
    errors.push({ field: 'barcode', message: 'Barcode duplikat dalam file' });
  }

  return errors;
}

// ── Download invalid rows as Excel ───────────────────────────────────────────

function downloadFailedExcel(failedRows, fieldLabels, headers) {
  const wb = XLSX.utils.book_new();

  const headerRow  = [...headers.map(h => fieldLabels[h]), 'Alasan Gagal'];
  const dataRows   = failedRows.map(({ data, errors, row_number }) => [
    ...headers.map(h => data[h] ?? ''),
    errors.join('; '),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  ws['!cols'] = headerRow.map(() => ({ wch: 22 }));

  // Mark header red
  headerRow.forEach((_, ci) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = { fill: { fgColor: { rgb: 'FEE2E2' } }, font: { bold: true } };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Data Gagal');
  XLSX.writeFile(wb, `produk_gagal_upload_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Main Component ────────────────────────────────────────────────────────────

const STEP = { TEMPLATE: 1, UPLOAD: 2, REVIEW: 3, RESULT: 4 };

export default function ProductBulkUpload({ onBack }) {
  const { toasts, addToast, removeToast } = useToast();

  const [tenants,       setTenants]       = useState([]);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);

  const [file,      setFile]      = useState(null);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [rows,      setRows]      = useState([]);
  const [showAll,   setShowAll]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null); // { inserted, failed, details }

  const inputRef = useRef(null);

  useEffect(() => {
    getAdminTenants({ include_inactive: 'false' })
      .then(r => { setTenants(r.data.data ?? []); setTenantsLoaded(true); })
      .catch(() => setTenantsLoaded(true));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const tenantNames = new Set(
    tenants.flatMap(t => [
      t.tenant_name?.trim().toLowerCase(),
      t.booth_location?.trim().toLowerCase(),
    ]).filter(Boolean)
  );

  const barcodesInBatch = rows.map(r => (r.barcode || '').trim());

  const validated = rows.map(r => {
    const errors = validateRow(r, tenantNames, barcodesInBatch);
    return { ...r, _errors: errors, _valid: errors.length === 0 };
  });

  const validRows   = validated.filter(r => r._valid);
  const invalidRows = validated.filter(r => !r._valid);
  const hasData     = rows.length > 0;
  const canSubmit   = validRows.length > 0;
  const preview     = showAll ? validated : validated.slice(0, 15);

  const currentStep = result ? STEP.RESULT : (hasData ? STEP.REVIEW : STEP.UPLOAD);

  // ── Template download ───────────────────────────────────────────────────────

  function downloadTemplate() {
    const exampleTenant = tenants[0]?.tenant_name || 'Nama Booth A';
    const exampleRow = {
      product_id:      'P001-T001',
      barcode:         '8991234567890',
      product_name:    'Gundam RX-78-2 MG',
      category:        'Action Figure',
      price:           420000,
      tenant:          exampleTenant,
      stock_quantity:  10,
      odoo_categ_name: '',
      description:     'Model kit skala 1/100 Master Grade',
    };

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS.map(h => FIELD_LABELS[h]),
      HEADERS.map(h => exampleRow[h]),
      HEADERS.map(h => FIELD_DESCS[h]),
    ]);
    ws['!cols'] = HEADERS.map(() => ({ wch: 28 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Produk');
    XLSX.writeFile(wb, 'template_produk_master.xlsx');
  }

  // ── File handling ───────────────────────────────────────────────────────────

  function processFile(f) {
    setFileError('');
    setRows([]);
    setResult(null);

    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) {
      setFileError('Format tidak didukung. Gunakan .xlsx atau .csv');
      return;
    }
    if (f.size > MAX_SIZE) {
      setFileError(`File terlalu besar (maks ${fmtBytes(MAX_SIZE)}). Ukuran: ${fmtBytes(f.size)}`);
      return;
    }
    setFile(f);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const parsed   = parseSheet(workbook);
        if (parsed.length === 0) {
          setFileError('File kosong atau header tidak sesuai template.');
          setFile(null);
          return;
        }
        if (parsed.length > MAX_ROWS) {
          setFileError(`Terlalu banyak baris (${parsed.length}). Maks ${MAX_ROWS} baris.`);
          setFile(null);
          return;
        }
        setRows(parsed);
      } catch {
        setFileError('Gagal membaca file. Pastikan format sesuai template.');
        setFile(null);
      }
    };
    reader.readAsArrayBuffer(f);
  }

  const handleInput = (e) => {
    if (e.target.files[0]) processFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  }, []); // eslint-disable-line

  function clearFile() {
    setFile(null); setRows([]); setFileError(''); setResult(null); setShowAll(false);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit || uploading) return;
    setUploading(true);
    try {
      const payload = validRows.map(r => ({
        product_id:      r.product_id      || '',
        barcode:         r.barcode,
        product_name:    r.product_name,
        category:        r.category,
        price:           r.price,
        tenant:          r.tenant,
        stock_quantity:  r.stock_quantity  || '0',
        odoo_categ_name: r.odoo_categ_name || '',
        description:     r.description    || '',
      }));

      const res  = await bulkUploadProducts(payload);
      const data = res.data;

      // Merge client-side invalid + server-side failed
      const clientFailed = invalidRows.map(r => ({
        row_number: r._rowIndex,
        data:       r,
        errors:     r._errors.map(e => e.message),
      }));
      const serverFailed = data.details?.failed || [];
      const allFailed    = [...clientFailed, ...serverFailed]
        .sort((a, b) => a.row_number - b.row_number);

      setResult({
        inserted: data.inserted,
        failed:   allFailed,
      });

      if (data.inserted > 0) {
        addToast(`${data.inserted} produk berhasil diupload.`, 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload gagal.';
      addToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white mb-4">
        <span className="text-base">⬆️</span>
        <h2 className="text-sm font-semibold flex-1">Upload Data Master Produk</h2>
        <button onClick={onBack}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
          ← Kembali
        </button>
      </div>

      {/* ── STEP 1: Template ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Langkah 1 — Unduh template Excel</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Template berisi 9 kolom. Kolom bertanda <span className="text-red-600 font-medium">** WAJIB</span> harus diisi.
            </p>
          </div>
        </div>

        {/* Field chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {HEADERS.map(h => (
            <span key={h}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium
                ${REQUIRED_FIELDS.includes(h)
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {FIELD_LABELS[h]}{REQUIRED_FIELDS.includes(h) ? ' **' : ''}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-medium transition-colors">
            ⬇ Unduh Template Excel
          </button>
        </div>

        {/* Tenant hint */}
        {tenants.length > 0 && (
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <p className="text-xs font-semibold text-blue-700 mb-1.5">
              Nama Booth / Tenant yang tersedia (isi kolom <span className="font-mono">tenant</span> dengan salah satu nama ini):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tenants.map(t => (
                <span key={t.tenant_id}
                  className="inline-flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-800 px-2 py-1 rounded-lg">
                  <span className="font-medium">{t.tenant_name}</span>
                  {t.booth_location && t.booth_location !== t.tenant_name && (
                    <span className="text-blue-400 text-[10px]">/ {t.booth_location}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />
            <span className="text-xs text-gray-500">Wajib diisi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 inline-block" />
            <span className="text-xs text-gray-500">Opsional</span>
          </div>
        </div>
      </div>

      {/* ── STEP 2: Upload ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <p className="text-sm font-semibold text-gray-800 mb-3">Langkah 2 — Unggah file yang sudah diisi</p>

        {file ? (
          <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-sm shrink-0">📄</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{fmtBytes(file.size)} · {rows.length} baris</p>
            </div>
            <button onClick={clearFile} className="text-xs text-violet-600 hover:underline font-medium shrink-0">
              Ganti file
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none
              ${isDragging ? 'border-violet-500 bg-violet-50' : 'border-violet-300 hover:bg-violet-50 hover:border-violet-400'}`}>
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Seret &amp; lepas file di sini</p>
            <p className="text-xs text-gray-500">
              atau <span className="text-violet-600 font-medium">klik untuk pilih file</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">.xlsx atau .csv · Maks 5 MB · Maks 1.000 baris</p>
          </div>
        )}

        <input ref={inputRef} type="file" accept=".xlsx,.csv" onChange={handleInput} className="hidden" />

        {fileError && (
          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            <span>⚠ {fileError}</span>
          </div>
        )}
      </div>

      {/* ── STEP 3: Review & Submit ───────────────────────────────────────────── */}
      {hasData && !result && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-800 mb-3">Langkah 3 — Review &amp; Submit</p>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total baris',     value: rows.length,        color: 'text-gray-800',  bg: 'bg-gray-50'   },
              { label: 'Siap diupload',   value: validRows.length,   color: 'text-green-700', bg: 'bg-green-50'  },
              { label: 'Perlu diperbaiki',value: invalidRows.length, color: 'text-red-700',   bg: 'bg-red-50'    },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} border border-gray-200 rounded-lg px-3 py-2.5`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Info: partial upload notice */}
          {invalidRows.length > 0 && validRows.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2.5 mb-3">
              <span className="shrink-0 text-base">ℹ️</span>
              <span>
                <strong>{validRows.length} baris valid akan diupload.</strong>{' '}
                <strong>{invalidRows.length} baris tidak valid akan dipisahkan</strong> dan bisa di-download untuk diperbaiki.
              </span>
            </div>
          )}

          {invalidRows.length > 0 && validRows.length === 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5 mb-3">
              <span>✕ Semua baris tidak valid. Perbaiki file lalu upload ulang.</span>
            </div>
          )}

          {/* Preview table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
              <span className="text-xs font-medium text-gray-700">
                Preview · {showAll ? rows.length : Math.min(15, rows.length)} baris
              </span>
              {invalidRows.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                  {invalidRows.length} baris error
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Baris', 'Barcode', 'Nama Produk', 'Kategori', 'Harga', 'Tenant', 'Stok', 'Status'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map(row => {
                    const errMap = Object.fromEntries(row._errors.map(e => [e.field, e.message]));
                    return (
                      <tr key={row._rowIndex}
                        className={`border-b border-gray-100 last:border-0 ${!row._valid ? 'bg-red-50' : ''}`}>
                        <td className="px-2.5 py-2 text-gray-400 font-mono">{row._rowIndex}</td>

                        <td className="px-2.5 py-2 font-mono">
                          {row.barcode || <span className="italic text-red-400">kosong</span>}
                          {errMap.barcode && <span className="block text-[10px] text-red-500">{errMap.barcode}</span>}
                        </td>

                        <td className="px-2.5 py-2 max-w-[160px] truncate">
                          {row.product_name || <span className="italic text-red-400">kosong</span>}
                          {errMap.product_name && <span className="block text-[10px] text-red-500">{errMap.product_name}</span>}
                        </td>

                        <td className="px-2.5 py-2 truncate">
                          {row.category || <span className="italic text-red-400">kosong</span>}
                          {errMap.category && <span className="block text-[10px] text-red-500">{errMap.category}</span>}
                        </td>

                        <td className="px-2.5 py-2 whitespace-nowrap">
                          {row.price ? fmtRupiah(row.price) : <span className="italic text-red-400">kosong</span>}
                          {errMap.price && <span className="block text-[10px] text-red-500">{errMap.price}</span>}
                        </td>

                        <td className="px-2.5 py-2 truncate">
                          {row.tenant || <span className="italic text-red-400">kosong</span>}
                          {errMap.tenant && <span className="block text-[10px] text-red-500">{errMap.tenant}</span>}
                        </td>

                        <td className="px-2.5 py-2 text-gray-600">{row.stock_quantity || '0'}</td>

                        <td className="px-2.5 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium
                            ${row._valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {row._valid ? '✓ Valid' : `✕ ${row._errors.length} error`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length > 15 && (
              <div className="px-3 py-2 border-t border-gray-100 text-center">
                <button onClick={() => setShowAll(v => !v)}
                  className="text-xs text-violet-600 hover:underline font-medium">
                  {showAll ? 'Tampilkan ringkas' : `Lihat semua ${rows.length} baris`}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2">
            <button onClick={clearFile}
              className="px-3 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium">
              Ganti File
            </button>

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={uploading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs px-4">
              {uploading
                ? 'Mengupload...'
                : invalidRows.length > 0
                  ? `Upload ${validRows.length} baris valid`
                  : `Upload ${validRows.length} produk`}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Result ────────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-800 mb-3">Hasil Upload</p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
              <p className="text-3xl font-bold text-green-700">{result.inserted}</p>
              <p className="text-xs text-green-600 mt-1">Produk berhasil diupload</p>
            </div>
            <div className={`${result.failed.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-xl px-4 py-3 text-center`}>
              <p className={`text-3xl font-bold ${result.failed.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                {result.failed.length}
              </p>
              <p className={`text-xs mt-1 ${result.failed.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                Baris gagal / tidak valid
              </p>
            </div>
          </div>

          {/* Failed rows detail */}
          {result.failed.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-red-700">Detail baris gagal:</p>
                <button
                  onClick={() => downloadFailedExcel(result.failed, FIELD_LABELS, HEADERS)}
                  className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                  ⬇ Download Excel Gagal
                </button>
              </div>

              <div className="border border-red-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50 border-b border-red-200">
                      <th className="px-3 py-2 text-left text-red-700">Baris</th>
                      <th className="px-3 py-2 text-left text-red-700">Barcode</th>
                      <th className="px-3 py-2 text-left text-red-700">Nama Produk</th>
                      <th className="px-3 py-2 text-left text-red-700">Alasan Gagal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f, i) => (
                      <tr key={i} className="border-b border-red-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-gray-500">{f.row_number}</td>
                        <td className="px-3 py-2 font-mono">{f.data?.barcode || f.data?.barcode || '—'}</td>
                        <td className="px-3 py-2 truncate max-w-[180px]">{f.data?.product_name || '—'}</td>
                        <td className="px-3 py-2 text-red-600">{f.errors?.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Download Excel di atas, perbaiki kolom <strong>Alasan Gagal</strong>, hapus kolom tersebut, lalu upload ulang.
              </p>
            </>
          )}

          <div className="flex gap-2">
            {result.failed.length > 0 && (
              <button onClick={clearFile}
                className="px-3 py-2 text-xs rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 font-medium">
                Upload Ulang File Baru
              </button>
            )}
            <button onClick={() => { onBack(); }}
              className="px-3 py-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              Selesai — Kembali ke Produk
            </button>
          </div>
        </div>
      )}
    </>
  );
}
