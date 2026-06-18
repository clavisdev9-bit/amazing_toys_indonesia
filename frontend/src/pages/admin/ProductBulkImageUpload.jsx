/**
 * ProductBulkImageUpload.jsx
 *
 * Admin bulk-image upload via ZIP + mapping.csv:
 *   1. Penjelasan format ZIP yang dibutuhkan
 *   2. Upload .zip, preview isi mapping.csv (client-side via JSZip)
 *   3. Submit ke POST /api/v1/admin/products/bulk-upload-images
 *   4. Tampilkan hasil: updated / notFound / skipped / errors
 *
 * Accepts `onBack` callback to return to product list.
 */

import React, { useState, useCallback, useRef } from 'react';
import Button from '../../components/ui/Button';
import ToastContainer from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { bulkUploadImages } from '../../api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function readCsvFromZip(zipFile) {
  // Parse mapping.csv from ZIP using built-in browser APIs (no extra lib needed)
  // We use JSZip if available, otherwise fall back to showing file name only.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Dynamic import JSZip (already in node_modules via xlsx's dependency chain)
        // Fallback: if JSZip unavailable, skip preview
        let JSZip;
        try {
          JSZip = (await import('jszip')).default;
        } catch {
          return resolve(null); // preview unavailable
        }
        const zip  = await JSZip.loadAsync(e.target.result);
        const csvFile = zip.file(/^mapping\.csv$/i)[0];
        if (!csvFile) return resolve(null);
        const text = await csvFile.async('string');
        const lines = text.trim().split('\n').filter(Boolean);
        const rows  = [];
        for (let i = 1; i < lines.length; i++) {
          const [barcode, filename] = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          if (barcode && filename) rows.push({ barcode, filename });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(zipFile);
  });
}

const STATUS = { IDLE: 'IDLE', PREVIEW: 'PREVIEW', UPLOADING: 'UPLOADING', DONE: 'DONE' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductBulkImageUpload({ onBack }) {
  const [status,      setStatus]      = useState(STATUS.IDLE);
  const [zipFile,     setZipFile]     = useState(null);
  const [previewRows, setPreviewRows] = useState(null); // null = could not read
  const [result,      setResult]      = useState(null);
  const [dragging,    setDragging]    = useState(false);
  const fileInputRef = useRef(null);
  const { toasts, showToast } = useToast();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast('Hanya file .zip yang diperbolehkan.', 'error');
      return;
    }
    setZipFile(file);
    setResult(null);
    const rows = await readCsvFromZip(file).catch(() => null);
    setPreviewRows(rows);
    setStatus(STATUS.PREVIEW);
  }, [showToast]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e) => {
    handleFile(e.target.files?.[0]);
  }, [handleFile]);

  const handleSubmit = useCallback(async () => {
    if (!zipFile) return;
    setStatus(STATUS.UPLOADING);
    try {
      const fd = new FormData();
      fd.append('zipFile', zipFile);
      const res  = await bulkUploadImages(fd);
      const data = res.data;
      setResult(data);
      setStatus(STATUS.DONE);
      if (data.summary?.updated > 0) {
        showToast(`${data.summary.updated} gambar berhasil diupdate.`, 'success');
      } else {
        showToast('Tidak ada gambar yang diupdate.', 'warning');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload gagal.';
      showToast(msg, 'error');
      setStatus(STATUS.PREVIEW);
    }
  }, [zipFile, showToast]);

  const reset = () => {
    setStatus(STATUS.IDLE);
    setZipFile(null);
    setPreviewRows(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-xl">←</button>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Bulk Upload Gambar Produk</h2>
          <p className="text-sm text-gray-500">Upload ZIP berisi gambar + mapping.csv (primary key: barcode)</p>
        </div>
      </div>

      {/* Format guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm">
        <p className="font-semibold text-blue-800 mb-2">Format ZIP yang dibutuhkan:</p>
        <pre className="bg-white rounded p-3 text-xs text-gray-700 font-mono border border-blue-100 whitespace-pre-wrap">
{`images_batch.zip
├── mapping.xlsx         ← wajib ada (Excel)
├── 8991234567890.jpg
├── nama-bebas.png
└── ...`}
        </pre>
        <p className="mt-3 font-semibold text-blue-800 mb-1">Isi mapping.xlsx (kolom wajib: barcode, filename):</p>
        <div className="bg-white rounded border border-blue-100 overflow-hidden mt-1">
          <table className="w-full text-xs font-mono">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-3 py-1.5 text-left">barcode</th>
                <th className="px-3 py-1.5 text-left">filename</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t"><td className="px-3 py-1">8991234567890</td><td className="px-3 py-1">8991234567890.jpg</td></tr>
              <tr className="border-t bg-gray-50"><td className="px-3 py-1">8991234567891</td><td className="px-3 py-1">nama-bebas.png</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-blue-700 text-xs">
          Juga mendukung mapping.csv sebagai fallback. Gambar di-resize max 800×800px → WebP otomatis. ZIP maks 100 MB.
        </p>
      </div>

      {/* Drop zone */}
      {status === STATUS.IDLE && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
        >
          <div className="text-4xl mb-2">📦</div>
          <p className="font-medium text-gray-700">Drag &amp; drop file .zip ke sini</p>
          <p className="text-sm text-gray-400 mt-1">atau klik untuk pilih file</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      )}

      {/* Preview */}
      {(status === STATUS.PREVIEW || status === STATUS.UPLOADING) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              File: <span className="text-blue-600">{zipFile?.name}</span>
              {previewRows !== null && (
                <span className="ml-2 text-gray-500">({previewRows.length} baris mapping)</span>
              )}
            </p>
            {status === STATUS.PREVIEW && (
              <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500">Ganti file</button>
            )}
          </div>

          {previewRows && previewRows.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600">#</th>
                    <th className="px-3 py-2 text-left text-gray-600">Barcode</th>
                    <th className="px-3 py-2 text-left text-gray-600">Nama File</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-800">{row.barcode}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.filename}</td>
                    </tr>
                  ))}
                  {previewRows.length > 20 && (
                    <tr className="border-t bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-center text-gray-400 text-xs">
                        ... dan {previewRows.length - 20} baris lainnya
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {previewRows === null && (
            <p className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              Preview mapping.csv tidak tersedia di browser ini, tapi upload tetap bisa dilanjutkan.
            </p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={status === STATUS.UPLOADING}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {status === STATUS.UPLOADING ? 'Mengupload...' : `Upload ${previewRows?.length ?? ''} Gambar`}
            </Button>
            {status === STATUS.PREVIEW && (
              <Button onClick={reset} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
                Batal
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {status === STATUS.DONE && result && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Berhasil', value: result.summary?.updated,   color: 'green' },
              { label: 'Tdk ditemukan', value: result.summary?.not_found, color: 'yellow' },
              { label: 'Dilewati', value: result.summary?.skipped,   color: 'orange' },
              { label: 'Error', value: result.summary?.errors,      color: 'red' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-lg p-3 text-center border border-${color}-200 bg-${color}-50`}>
                <p className={`text-2xl font-bold text-${color}-700`}>{value ?? 0}</p>
                <p className={`text-xs text-${color}-600 mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>

          {/* Updated list */}
          {result.details?.updated?.length > 0 && (
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-green-700 mb-2">
                Gambar yang diupdate ({result.details.updated.length})
              </summary>
              <div className="border rounded-lg overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-green-700">Barcode</th>
                      <th className="px-3 py-2 text-left text-green-700">Product ID</th>
                      <th className="px-3 py-2 text-left text-green-700">URL Gambar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.updated.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{r.barcode}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.product_id}</td>
                        <td className="px-3 py-1.5 text-blue-600 text-xs break-all">{r.image_url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Not found */}
          {result.details?.notFound?.length > 0 && (
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-yellow-700 mb-2">
                Barcode tidak ditemukan di DB ({result.details.notFound.length})
              </summary>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
                {result.details.notFound.map((bc, i) => (
                  <span key={i} className="inline-block font-mono text-xs bg-yellow-100 text-yellow-800 rounded px-2 py-0.5 mr-1 mb-1">{bc}</span>
                ))}
              </div>
            </details>
          )}

          {/* Skipped */}
          {result.details?.skipped?.length > 0 && (
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-orange-700 mb-2">
                File tidak ada di ZIP ({result.details.skipped.length})
              </summary>
              <div className="border rounded-lg overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-orange-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-orange-700">Barcode</th>
                      <th className="px-3 py-2 text-left text-orange-700">Filename</th>
                      <th className="px-3 py-2 text-left text-orange-700">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.skipped.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{r.barcode}</td>
                        <td className="px-3 py-1.5">{r.filename}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Errors */}
          {result.details?.errors?.length > 0 && (
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-red-700 mb-2">
                Error ({result.details.errors.length})
              </summary>
              <div className="border rounded-lg overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-red-700">Barcode</th>
                      <th className="px-3 py-2 text-left text-red-700">File</th>
                      <th className="px-3 py-2 text-left text-red-700">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.errors.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{r.barcode}</td>
                        <td className="px-3 py-1.5">{r.filename}</td>
                        <td className="px-3 py-1.5 text-red-600">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <div className="flex gap-3 mt-4">
            <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700 text-white">
              Upload Batch Lain
            </Button>
            <Button onClick={onBack} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
              Kembali ke Produk
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
