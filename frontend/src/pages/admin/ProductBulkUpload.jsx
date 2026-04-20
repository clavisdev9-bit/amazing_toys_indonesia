/**
 * ProductBulkUpload.jsx
 *
 * Admin bulk-upload flow for product master data (three-step wizard):
 *   1. Download an Excel template (SheetJS).
 *   2. Drag-and-drop or browse to upload a filled .xlsx / .csv file.
 *   3. Review a client-validated preview table, then submit to
 *      POST /api/v1/admin/products/bulk-upload.
 *
 * Accepts an `onBack` callback so the parent can swap back to the product list.
 */

import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Button from '../../components/ui/Button';
import ToastContainer from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { bulkUploadProducts } from '../../api/admin';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEADERS = [
  'product_id', 'product_name', 'category', 'price', 'tenant_id',
  'barcode', 'stock_quantity', 'description', 'image_url',
  'odoo_categ_id', 'odoo_categ_name', 'is_active',
];

const REQUIRED_FIELDS = ['product_name', 'category', 'price', 'tenant_id'];

const FIELD_DESCS = {
  product_id:      'ID unik produk – kosongkan untuk auto-generate (cth: P001-T001)',
  product_name:    '* WAJIB – Nama produk',
  category:        '* WAJIB – Kategori produk (cth: Action Figure)',
  price:           '* WAJIB – Harga satuan angka (cth: 420000)',
  tenant_id:       '* WAJIB – ID tenant/booth (cth: T001)',
  barcode:         'Barcode EAN-13 atau Code128, opsional',
  stock_quantity:  'Jumlah stok awal, default 0',
  description:     'Deskripsi produk, opsional',
  image_url:       'URL foto produk, opsional (https://...)',
  odoo_categ_id:   'ID kategori Odoo (angka), opsional',
  odoo_categ_name: 'Nama kategori Odoo, opsional',
  is_active:       'Status aktif: true atau false (default true)',
};

const EXAMPLE_ROW = {
  product_id:      'P001-T001',
  product_name:    'Gundam RX-78-2 MG',
  category:        'Action Figure',
  price:           420000,
  tenant_id:       'T001',
  barcode:         '8999999001234',
  stock_quantity:  10,
  description:     'Model kit skala 1/100 Master Grade',
  image_url:       '',
  odoo_categ_id:   '',
  odoo_categ_name: '',
  is_active:       true,
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 1000;
const URL_RE   = /^https?:\/\//i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (val === 1 || val === 0)   return val === 1;
  const s = String(val ?? '').trim().toLowerCase();
  if (['true', '1', 'yes'].includes(s))  return true;
  if (['false', '0', 'no'].includes(s))  return false;
  return true;
}

function fmtBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRupiah(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return [];

  const headerRow = raw[0].map(h => String(h).trim().toLowerCase());
  const colMap    = {};
  headerRow.forEach((h, i) => { if (HEADERS.includes(h)) colMap[h] = i; });

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    if (cells.every(c => c === '' || c == null)) continue; // skip blank rows

    const row = { _rowIndex: i };
    for (const field of HEADERS) {
      const ci   = colMap[field];
      row[field] = ci !== undefined ? String(cells[ci] ?? '').trim() : '';
    }

    // Type coercions
    row.is_active      = parseBoolean(row.is_active === '' ? 'true' : row.is_active);
    row.odoo_categ_id  = row.odoo_categ_id === '' ? null : (parseInt(row.odoo_categ_id) || null);
    row.stock_quantity = String(parseInt(row.stock_quantity) || 0);

    rows.push(row);
  }
  return rows;
}

// ── Client-side validation ────────────────────────────────────────────────────

function validateRow(row, allNames) {
  const errors   = [];
  const warnings = [];

  for (const f of REQUIRED_FIELDS) {
    if (!row[f] || String(row[f]).trim() === '') {
      errors.push({ field: f, message: `${f} wajib diisi` });
    }
  }

  if (row.price !== undefined && row.price !== '') {
    const p = parseFloat(row.price);
    if (isNaN(p) || p < 0) errors.push({ field: 'price', message: 'harus angka ≥ 0' });
  }

  if (row.image_url && String(row.image_url).trim() !== '') {
    if (!URL_RE.test(String(row.image_url).trim()))
      errors.push({ field: 'image_url', message: 'harus diawali https:// atau http://' });
  }

  // Duplicate product_name within the batch (warning, not blocking)
  const name = (row.product_name || '').trim().toLowerCase();
  if (name && allNames.filter(n => n === name).length > 1)
    warnings.push({ field: 'product_name', message: 'duplikat nama dalam file' });

  return { errors, warnings };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ErrorHint({ text }) {
  return <span className="block text-[10px] text-red-500 mt-0.5 leading-tight">{text}</span>;
}

function WarnHint({ text }) {
  return <span className="block text-[10px] text-amber-500 mt-0.5 leading-tight">{text}</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductBulkUpload({ onBack }) {
  const { toasts, addToast, removeToast } = useToast();

  const [file, setFile]             = useState(null);
  const [fileError, setFileError]   = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows]             = useState([]);
  const [showAll, setShowAll]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [serverError, setServerError] = useState('');

  const dropRef  = useRef(null);
  const inputRef = useRef(null);

  // ── Derived state ───────────────────────────────────────────────────────────

  const allNames = rows.map(r => (r.product_name || '').trim().toLowerCase());

  const validated = rows.map(r => {
    const { errors, warnings } = validateRow(r, allNames);
    return { ...r, _errors: errors, _warnings: warnings, _valid: errors.length === 0 };
  });

  const validRows   = validated.filter(r => r._valid);
  const invalidRows = validated.filter(r => !r._valid);
  const hasData     = rows.length > 0;
  const canSubmit   = hasData && invalidRows.length === 0;
  const preview     = showAll ? validated : validated.slice(0, 10);

  // ── Template download ───────────────────────────────────────────────────────

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      HEADERS.map(h => EXAMPLE_ROW[h]),
      HEADERS.map(h => FIELD_DESCS[h]),
    ]);
    ws['!cols'] = HEADERS.map(() => ({ wch: 26 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Produk');
    XLSX.writeFile(wb, 'template_produk_master.xlsx');
  }

  // ── File handling ───────────────────────────────────────────────────────────

  function processFile(f) {
    setFileError('');
    setRows([]);
    setServerError('');

    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) {
      setFileError('Format tidak didukung. Gunakan .xlsx atau .csv');
      return;
    }
    if (f.size > MAX_SIZE) {
      setFileError(`File terlalu besar (maks ${fmtBytes(MAX_SIZE)}). Ukuran file: ${fmtBytes(f.size)}`);
      return;
    }

    setFile(f);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const parsed   = parseSheet(workbook);

        if (parsed.length === 0) {
          setFileError('File kosong atau format tidak sesuai template. Pastikan baris header ada di baris pertama.');
          setFile(null);
          return;
        }
        if (parsed.length > MAX_ROWS) {
          setFileError(`Terlalu banyak baris (${parsed.length}). Maks ${MAX_ROWS} baris per upload.`);
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
    const f = e.target.files[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = ()  => setIsDragging(false);

  function clearFile() {
    setFile(null);
    setRows([]);
    setFileError('');
    setServerError('');
    setShowAll(false);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit || uploading) return;
    setServerError('');
    setUploading(true);
    try {
      const payload = validRows.map(r => ({
        product_id:      r.product_id      || '',
        product_name:    r.product_name,
        category:        r.category,
        price:           r.price,
        tenant_id:       r.tenant_id,
        barcode:         r.barcode         || '',
        stock_quantity:  r.stock_quantity,
        description:     r.description     || '',
        image_url:       r.image_url       || '',
        odoo_categ_id:   r.odoo_categ_id,
        odoo_categ_name: r.odoo_categ_name || '',
        is_active:       r.is_active,
      }));

      const res = await bulkUploadProducts(payload);
      addToast(`Berhasil mengunggah ${res.data.inserted} produk baru.`, 'success');
      setTimeout(onBack, 1800);
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors?.length) {
        setServerError(`${data.errors.length} baris gagal validasi server. Periksa data dan coba lagi.`);
      } else {
        setServerError(data?.message || err.message || 'Gagal upload. Silakan coba lagi.');
      }
    } finally {
      setUploading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white mb-4">
        <span className="text-base">⬆️</span>
        <h2 className="text-sm font-semibold flex-1">Upload Data Master Produk</h2>
        <button
          onClick={onBack}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
          ← Kembali ke Daftar Produk
        </button>
      </div>

      {/* ── STEP 1: Template ────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-gray-800">Langkah 1 — Unduh template Excel</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Template berisi header kolom dan satu baris contoh. Kolom bertanda
              {' '}<span className="font-medium text-amber-600">* WAJIB</span> harus diisi.
              Jangan ubah nama kolom header.
            </p>
          </div>
          <span className="shrink-0 text-xs bg-violet-100 text-violet-700 font-medium px-2.5 py-1 rounded-full">
            xlsx / csv
          </span>
        </div>

        {/* Field chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {HEADERS.map(h => (
            <span
              key={h}
              className={`text-xs px-2 py-0.5 rounded-full border font-mono
                ${REQUIRED_FIELDS.includes(h)
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {h}{REQUIRED_FIELDS.includes(h) ? ' *' : ''}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-medium transition-colors">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12M8 12l4 4 4-4"/>
            </svg>
            Unduh Template Excel
          </button>
          <span className="text-xs text-gray-400">template_produk_master.xlsx · ~8 KB</span>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-400 inline-block" />
            <span className="text-xs text-gray-500">Wajib diisi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 inline-block" />
            <span className="text-xs text-gray-500">Opsional</span>
          </div>
        </div>
      </div>

      {/* ── STEP 2: Upload ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <p className="text-sm font-semibold text-gray-800 mb-3">Langkah 2 — Unggah file yang sudah diisi</p>

        {file ? (
          /* File info bar */
          <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-sm shrink-0">📄</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{fmtBytes(file.size)}</p>
            </div>
            <button
              onClick={clearFile}
              className="text-xs text-violet-600 hover:underline font-medium shrink-0">
              Ganti file
            </button>
          </div>
        ) : (
          /* Drop zone */
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none
              ${isDragging
                ? 'border-violet-500 bg-violet-50'
                : 'border-violet-300 hover:bg-violet-50 hover:border-violet-400'}`}>
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                <path stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4M8 8l4-4 4 4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Seret &amp; lepas file di sini</p>
            <p className="text-xs text-gray-500">
              atau <span className="text-violet-600 font-medium">klik untuk memilih file</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">Mendukung .xlsx dan .csv · Maks 5 MB · Maks 1.000 baris</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleInput}
          className="hidden" />

        {fileError && (
          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            <span className="shrink-0">⚠</span>
            <span>{fileError}</span>
          </div>
        )}
      </div>

      {/* ── STEP 3: Review & Submit ─────────────────────────────────────────── */}
      {hasData && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-800 mb-3">Langkah 3 — Review &amp; submit</p>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total baris',      value: rows.length,        cls: 'text-gray-800' },
              { label: 'Data valid',        value: validRows.length,   cls: 'text-green-600' },
              { label: 'Data bermasalah',  value: invalidRows.length, cls: 'text-red-600' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <p className={`text-2xl font-semibold ${cls}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
              <span className="text-xs font-medium text-gray-700">
                Preview data
                <span className="text-gray-400 font-normal ml-1">
                  · {showAll ? `semua ${rows.length}` : `${Math.min(10, rows.length)}`} baris
                </span>
              </span>
              {invalidRows.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                  {invalidRows.length} baris perlu diperbaiki
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs table-fixed">
                <colgroup>
                  <col style={{ width: '3.5%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '9.5%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Nama Produk', 'Kategori', 'Harga', 'Stok', 'Tenant', 'ID', 'Status', 'Error'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map(row => {
                    const nameErr    = row._errors.find(e => e.field === 'product_name');
                    const catErr     = row._errors.find(e => e.field === 'category');
                    const priceErr   = row._errors.find(e => e.field === 'price');
                    const tenantErr  = row._errors.find(e => e.field === 'tenant_id');
                    const nameWarn   = row._warnings.find(w => w.field === 'product_name');

                    return (
                      <tr
                        key={row._rowIndex}
                        className={`border-b border-gray-100 last:border-0 ${!row._valid ? 'bg-red-50' : ''}`}>
                        <td className="px-2.5 py-2 text-gray-400 font-mono">{row._rowIndex}</td>

                        <td className="px-2.5 py-2 truncate">
                          <span className={nameErr ? 'text-red-700' : ''}>
                            {row.product_name || <span className="italic text-red-400">kosong</span>}
                          </span>
                          {nameErr  && <ErrorHint text={nameErr.message} />}
                          {nameWarn && <WarnHint  text={nameWarn.message} />}
                        </td>

                        <td className="px-2.5 py-2 truncate">
                          {row.category || <span className="italic text-red-400">kosong</span>}
                          {catErr && <ErrorHint text={catErr.message} />}
                        </td>

                        <td className="px-2.5 py-2 whitespace-nowrap">
                          {row.price ? fmtRupiah(row.price) : <span className="italic text-red-400">kosong</span>}
                          {priceErr && <ErrorHint text={priceErr.message} />}
                        </td>

                        <td className="px-2.5 py-2 text-gray-700">{row.stock_quantity || '0'}</td>

                        <td className="px-2.5 py-2 font-mono text-gray-600 truncate">
                          {row.tenant_id || <span className="italic text-red-400">kosong</span>}
                          {tenantErr && <ErrorHint text={tenantErr.message} />}
                        </td>

                        <td className="px-2.5 py-2 font-mono text-gray-400 truncate text-[10px]">
                          {row.product_id || <span className="text-gray-300">auto</span>}
                        </td>

                        <td className="px-2.5 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium
                            ${row._valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {row._valid ? 'Valid' : 'Error'}
                          </span>
                          {row._warnings.length > 0 && row._valid && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 mt-0.5 block">
                              Peringatan
                            </span>
                          )}
                        </td>

                        <td className="px-2.5 py-2">
                          {row._errors.length > 0 && (
                            <span className="text-red-500 font-medium">{row._errors.length} error</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length > 10 && (
              <div className="px-3 py-2 border-t border-gray-100 text-center">
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="text-xs text-violet-600 hover:underline font-medium">
                  {showAll ? 'Tampilkan ringkas' : `Lihat semua ${rows.length} baris`}
                </button>
              </div>
            )}
          </div>

          {/* Server error banner */}
          {serverError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">
              <span className="shrink-0 font-bold mt-0.5">✕</span>
              <span>{serverError}</span>
            </div>
          )}

          {/* Action row */}
          <div className="flex justify-end items-center gap-2">
            <button
              onClick={onBack}
              className="px-3 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors">
              Batal
            </button>

            {invalidRows.length > 0 && (
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-red-500 text-white opacity-50 cursor-not-allowed font-medium">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                Perbaiki {invalidRows.length} error dulu
              </button>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={uploading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs px-4">
              Simpan {validRows.length} data valid
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
