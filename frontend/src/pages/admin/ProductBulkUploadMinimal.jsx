/**
 * ProductBulkUploadMinimal.jsx
 *
 * FASE 1 — Upload produk minimal (4 kolom):
 *   Barcode | Nama Produk | Kategori | Harga (Rp)
 *
 * Tenant dan Stok = kosong (diisi di Fase 2 via "Update Stok & Tenant")
 *
 * Behavior: partial upload — baris valid langsung masuk, baris gagal bisa di-download.
 */

import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Button from '../../components/ui/Button';
import ToastContainer from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { bulkUploadMinimal } from '../../api/admin';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEADERS = ['barcode', 'product_name', 'category', 'price'];

const FIELD_LABELS = {
  barcode:      'Barcode',
  product_name: 'Nama Produk',
  category:     'Kategori',
  price:        'Harga (Rp)',
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

  const rawHeaders = raw[0].map(h =>
    String(h).trim().toLowerCase()
      .replace(/\s*\(rp\)/i, '')
      .replace(/\s+/g, '_')
      .replace(/nama_produk|nama\s*produk/i, 'product_name')
      .replace(/harga/i, 'price')
      .replace(/kategori$/i, 'category')
  );

  const colMap = {};
  HEADERS.forEach(h => {
    const idx = rawHeaders.indexOf(h);
    if (idx !== -1) colMap[h] = idx;
  });

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    if (cells.every(c => c === '' || c == null)) continue;
    const row = { _rowIndex: i + 1 };
    for (const field of HEADERS) {
      const ci   = colMap[field];
      row[field] = ci !== undefined ? String(cells[ci] ?? '').trim() : '';
    }
    rows.push(row);
  }
  return rows;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateRow(row, barcodesInBatch) {
  const errors = [];
  for (const f of HEADERS) {
    if (!row[f] || row[f].trim() === '') {
      errors.push({ field: f, message: `${FIELD_LABELS[f]} wajib diisi` });
    }
  }
  if (row.price && row.price.trim() !== '') {
    const p = parseFloat(row.price);
    if (isNaN(p) || p < 0) errors.push({ field: 'price', message: 'Harga harus angka ≥ 0' });
  }
  const bc = (row.barcode || '').trim();
  if (bc && barcodesInBatch.filter(b => b === bc).length > 1) {
    errors.push({ field: 'barcode', message: 'Barcode duplikat dalam file' });
  }
  return errors;
}

// ── Download failed Excel ─────────────────────────────────────────────────────

function downloadFailedExcel(failedRows) {
  const wb  = XLSX.utils.book_new();
  const hdr = [...HEADERS.map(h => FIELD_LABELS[h]), 'Alasan Gagal'];
  const data = failedRows.map(({ data, errors }) => [
    ...HEADERS.map(h => data[h] ?? ''),
    errors.join('; '),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([hdr, ...data]);
  ws['!cols'] = hdr.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Gagal');
  XLSX.writeFile(wb, `produk_gagal_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductBulkUploadMinimal({ onBack, onGoToStockTenant }) {
  const { toasts, addToast, removeToast } = useToast();

  const [file,      setFile]      = useState(null);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [rows,      setRows]      = useState([]);
  const [showAll,   setShowAll]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);
  const inputRef = useRef(null);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const barcodesInBatch = rows.map(r => (r.barcode || '').trim());

  const validated = rows.map(r => {
    const errors = validateRow(r, barcodesInBatch);
    return { ...r, _errors: errors, _valid: errors.length === 0 };
  });

  const validRows   = validated.filter(r => r._valid);
  const invalidRows = validated.filter(r => !r._valid);
  const hasData     = rows.length > 0;
  const preview     = showAll ? validated : validated.slice(0, 15);

  // ── Template download ─────────────────────────────────────────────────────────

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS.map(h => FIELD_LABELS[h]),
      ['8991234567890', 'Gundam RX-78-2 MG', 'Action Figure', 420000],
      ['8991234567891', 'Tomica Car Red',     'Die-cast',      85000],
      ['(* semua kolom wajib diisi)', '', '', ''],
    ]);
    ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Produk Minimal');
    XLSX.writeFile(wb, 'template_produk_minimal.xlsx');
  }

  // ── File handling ─────────────────────────────────────────────────────────────

  function processFile(f) {
    setFileError(''); setRows([]); setResult(null);
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) { setFileError('Gunakan .xlsx atau .csv'); return; }
    if (f.size > MAX_SIZE) { setFileError(`File terlalu besar (maks ${fmtBytes(MAX_SIZE)})`); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const rows = parseSheet(wb);
        if (rows.length === 0) { setFileError('File kosong atau header tidak cocok dengan template.'); setFile(null); return; }
        if (rows.length > MAX_ROWS) { setFileError(`Terlalu banyak baris (${rows.length}). Maks ${MAX_ROWS}.`); setFile(null); return; }
        setRows(rows);
      } catch { setFileError('Gagal membaca file.'); setFile(null); }
    };
    reader.readAsArrayBuffer(f);
  }

  const handleInput = (e) => { if (e.target.files[0]) processFile(e.target.files[0]); e.target.value = ''; };
  const handleDrop  = useCallback((e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }, []); // eslint-disable-line

  function clearFile() { setFile(null); setRows([]); setFileError(''); setResult(null); setShowAll(false); }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validRows.length || uploading) return;
    setUploading(true);
    try {
      const payload = validRows.map(r => ({
        barcode:      r.barcode,
        product_name: r.product_name,
        category:     r.category,
        price:        r.price,
      }));
      const res  = await bulkUploadMinimal(payload);
      const data = res.data;

      const clientFailed = invalidRows.map(r => ({
        row_number: r._rowIndex,
        data:       r,
        errors:     r._errors.map(e => e.message),
      }));
      const allFailed = [...clientFailed, ...(data.details?.failed || [])]
        .sort((a, b) => a.row_number - b.row_number);

      setResult({ inserted: data.inserted, failed: allFailed });
      if (data.inserted > 0) addToast(`${data.inserted} produk berhasil ditambahkan.`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Upload gagal.', 'error');
    } finally {
      setUploading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white mb-4">
        <span>⚡</span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Upload Produk Minimal — Fase 1</h2>
          <p className="text-xs text-white/70">Barcode · Nama Produk · Kategori · Harga</p>
        </div>
        <button onClick={onBack}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
          ← Kembali
        </button>
      </div>

      {/* Workflow banner */}
      <div className="flex items-stretch gap-0 mb-4 rounded-xl overflow-hidden border border-gray-200 text-xs">
        <div className="flex-1 bg-teal-600 text-white px-4 py-3">
          <p className="font-bold mb-0.5">Fase 1 — Sekarang</p>
          <p className="text-white/80">Upload 4 kolom wajib</p>
          <p className="text-white/60 mt-1">Tenant &amp; Stok = kosong</p>
        </div>
        <div className="w-px bg-white/30" />
        <div className="flex-1 bg-gray-100 text-gray-500 px-4 py-3">
          <p className="font-bold mb-0.5 text-gray-600">Fase 2 — Setelah ini</p>
          <p>"Update Stok &amp; Tenant"</p>
          <p className="text-gray-400 mt-1">Gunakan tombol di toolbar</p>
        </div>
      </div>

      {/* Step 1: Template */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <p className="text-sm font-semibold text-gray-800 mb-2">Langkah 1 — Unduh template</p>

        <div className="flex gap-2 mb-3">
          {HEADERS.map(h => (
            <span key={h}
              className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">
              {FIELD_LABELS[h]} **
            </span>
          ))}
        </div>

        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg font-medium transition-colors">
          ⬇ Unduh Template Minimal
        </button>
      </div>

      {/* Step 2: Upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <p className="text-sm font-semibold text-gray-800 mb-3">Langkah 2 — Unggah file</p>

        {file ? (
          <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-sm shrink-0">📄</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{fmtBytes(file.size)} · {rows.length} baris</p>
            </div>
            <button onClick={clearFile} className="text-xs text-teal-600 hover:underline font-medium">Ganti</button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragging ? 'border-teal-500 bg-teal-50' : 'border-teal-300 hover:bg-teal-50 hover:border-teal-400'}`}>
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Seret &amp; lepas file di sini</p>
            <p className="text-xs text-gray-500">atau <span className="text-teal-600 font-medium">klik untuk pilih file</span></p>
            <p className="text-xs text-gray-400 mt-2">.xlsx atau .csv · Maks 5 MB · 1.000 baris</p>
          </div>
        )}

        <input ref={inputRef} type="file" accept=".xlsx,.csv" onChange={handleInput} className="hidden" />
        {fileError && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {fileError}</div>
        )}
      </div>

      {/* Step 3: Review */}
      {hasData && !result && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-800 mb-3">Langkah 3 — Review &amp; Submit</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Total',           value: rows.length,        cls: 'text-gray-800',  bg: 'bg-gray-50'  },
              { label: 'Siap upload',     value: validRows.length,   cls: 'text-teal-700',  bg: 'bg-teal-50'  },
              { label: 'Perlu diperbaiki',value: invalidRows.length, cls: 'text-red-700',   bg: 'bg-red-50'   },
            ].map(({ label, value, cls, bg }) => (
              <div key={label} className={`${bg} border border-gray-200 rounded-lg px-3 py-2.5`}>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {invalidRows.length > 0 && validRows.length > 0 && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-3">
              ℹ️ <strong>{validRows.length} baris valid akan diupload.</strong>{' '}
              {invalidRows.length} baris tidak valid akan dipisahkan dan bisa di-download.
            </div>
          )}

          {/* Preview table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
              <span className="text-xs font-medium text-gray-700">Preview · {preview.length} dari {rows.length} baris</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Baris</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Barcode</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Nama Produk</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Kategori</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Harga</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(row => {
                    const em = Object.fromEntries(row._errors.map(e => [e.field, e.message]));
                    return (
                      <tr key={row._rowIndex} className={`border-b border-gray-100 last:border-0 ${!row._valid ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 text-gray-400 font-mono">{row._rowIndex}</td>
                        <td className="px-3 py-2 font-mono">
                          {row.barcode || <span className="italic text-red-400">kosong</span>}
                          {em.barcode && <span className="block text-[10px] text-red-500">{em.barcode}</span>}
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate">
                          {row.product_name || <span className="italic text-red-400">kosong</span>}
                          {em.product_name && <span className="block text-[10px] text-red-500">{em.product_name}</span>}
                        </td>
                        <td className="px-3 py-2 truncate">
                          {row.category || <span className="italic text-red-400">kosong</span>}
                          {em.category && <span className="block text-[10px] text-red-500">{em.category}</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.price ? fmtRupiah(row.price) : <span className="italic text-red-400">kosong</span>}
                          {em.price && <span className="block text-[10px] text-red-500">{em.price}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium
                            ${row._valid ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
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
              <div className="px-3 py-2 border-t text-center">
                <button onClick={() => setShowAll(v => !v)} className="text-xs text-teal-600 hover:underline font-medium">
                  {showAll ? 'Ringkas' : `Lihat semua ${rows.length} baris`}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end items-center gap-2">
            <button onClick={clearFile}
              className="px-3 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium">
              Ganti File
            </button>
            <Button
              onClick={handleSubmit}
              disabled={!validRows.length}
              loading={uploading}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs px-4">
              {uploading ? 'Mengupload...' : `Upload ${validRows.length} produk`}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-800 mb-3">Hasil Upload Fase 1</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-center">
              <p className="text-3xl font-bold text-teal-700">{result.inserted}</p>
              <p className="text-xs text-teal-600 mt-1">Produk berhasil ditambahkan</p>
              <p className="text-[10px] text-teal-400 mt-0.5">Tenant &amp; Stok = belum diisi</p>
            </div>
            <div className={`${result.failed.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-xl px-4 py-3 text-center`}>
              <p className={`text-3xl font-bold ${result.failed.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                {result.failed.length}
              </p>
              <p className={`text-xs mt-1 ${result.failed.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>Baris gagal</p>
            </div>
          </div>

          {/* Failed detail */}
          {result.failed.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-red-700">Baris gagal:</p>
                <button
                  onClick={() => downloadFailedExcel(result.failed)}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium">
                  ⬇ Download Excel Gagal
                </button>
              </div>
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50 border-b border-red-200">
                      <th className="px-3 py-2 text-left text-red-700">Baris</th>
                      <th className="px-3 py-2 text-left text-red-700">Barcode</th>
                      <th className="px-3 py-2 text-left text-red-700">Nama Produk</th>
                      <th className="px-3 py-2 text-left text-red-700">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f, i) => (
                      <tr key={i} className="border-b border-red-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-gray-500">{f.row_number}</td>
                        <td className="px-3 py-2 font-mono">{f.data?.barcode || '—'}</td>
                        <td className="px-3 py-2 truncate max-w-[160px]">{f.data?.product_name || '—'}</td>
                        <td className="px-3 py-2 text-red-600">{f.errors?.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Next step banner */}
          {result.inserted > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">Lanjutkan ke Fase 2</p>
              <p className="text-xs text-blue-700 mb-2">
                {result.inserted} produk sudah masuk database tanpa Tenant &amp; Stok.
                Gunakan <strong>"↻ Update Stok &amp; Tenant"</strong> untuk mengisi keduanya sekaligus via barcode.
              </p>
              {onGoToStockTenant && (
                <button
                  onClick={onGoToStockTenant}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">
                  Buka Update Stok &amp; Tenant →
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {result.failed.length > 0 && (
              <button onClick={clearFile}
                className="px-3 py-2 text-xs rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 font-medium">
                Upload Ulang
              </button>
            )}
            <button onClick={onBack}
              className="px-3 py-2 text-xs rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium">
              Selesai — Kembali ke Produk
            </button>
          </div>
        </div>
      )}
    </>
  );
}
