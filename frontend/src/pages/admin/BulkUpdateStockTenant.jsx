/**
 * BulkUpdateStockTenant.jsx
 *
 * Upload .xlsx berformat 3 kolom: Barcode | Stok | Tenant
 * Update stock_quantity dan tenant_id berdasarkan primary key Barcode.
 */

import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Button from '../../components/ui/Button';
import ToastContainer from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import client from '../../api/client';

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 5000;

function parseSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return { rows: [], errors: [] };

  // Normalize headers — support Barcode/barcode, Stok/stok/stock_quantity, Tenant/tenant
  const headers = raw[0].map(h => String(h).trim().toLowerCase());
  const col = {
    barcode: headers.findIndex(h => h === 'barcode'),
    stok:    headers.findIndex(h => ['stok', 'stock_quantity', 'stock', 'qty'].includes(h)),
    tenant:  headers.findIndex(h => ['tenant', 'booth', 'tenant_id', 'booth_location'].includes(h)),
  };

  const missing = Object.entries(col).filter(([, v]) => v === -1).map(([k]) => k);
  if (missing.length) {
    return { rows: [], errors: [`Kolom tidak ditemukan: ${missing.join(', ')}. Header yang dibutuhkan: Barcode, Stok, Tenant`] };
  }

  const rows = [];
  const errors = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const barcode = String(r[col.barcode] ?? '').trim();
    if (!barcode) continue; // skip empty barcode rows

    const stok = r[col.stok];
    const stockNum = parseInt(stok, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      errors.push(`Baris ${i + 1}: Stok "${stok}" tidak valid untuk barcode "${barcode}"`);
      continue;
    }

    rows.push({
      barcode,
      stock_quantity: stockNum,
      tenant: String(r[col.tenant] ?? '').trim(),
    });
  }
  return { rows, errors };
}

export default function BulkUpdateStockTenant({ onBack, onDone }) {
  const [step, setStep]         = useState(1); // 1=upload, 2=preview, 3=result
  const [rows, setRows]         = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState(null);
  const fileRef = useRef();
  const { toasts, addToast, removeToast } = useToast();

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { addToast('File terlalu besar (maks 10 MB).', 'error'); return; }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      addToast('Format file harus .xlsx, .xls, atau .csv', 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const { rows: parsed, errors } = parseSheet(wb);
        setParseErrors(errors);
        if (errors.length && !parsed.length) { addToast('File tidak dapat diproses. Cek format kolom.', 'error'); return; }
        if (parsed.length > MAX_ROWS) { addToast(`Terlalu banyak baris (maks ${MAX_ROWS}).`, 'error'); return; }
        setRows(parsed);
        setStep(2);
      } catch {
        addToast('File tidak dapat dibaca. Pastikan format Excel valid.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [addToast]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await client.post('/admin/products/bulk-update-stock-tenant', { rows });
      setResult(res.data);
      setStep(3);
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal mengirim data.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 1: Upload ─────────────────────────────────────────────────────────
  if (step === 1) return (
    <div className="p-6 max-w-xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 text-sm">← Kembali</button>
        <h2 className="text-base font-semibold text-gray-800">Update Stok & Tenant by Barcode</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm text-blue-800">
        <p className="font-semibold mb-1">Format file yang dibutuhkan:</p>
        <p>Kolom: <code className="bg-blue-100 px-1 rounded">Barcode</code> | <code className="bg-blue-100 px-1 rounded">Stok</code> | <code className="bg-blue-100 px-1 rounded">Tenant</code></p>
        <p className="mt-1 text-xs text-blue-700">Nilai Tenant dicocokkan dengan <em>Lokasi Booth</em> atau <em>Nama Tenant</em> (tidak case-sensitive).</p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <div className="text-3xl mb-2">📂</div>
        <p className="text-sm font-medium text-gray-700">Drag & drop file di sini, atau klik untuk pilih</p>
        <p className="text-xs text-gray-500 mt-1">.xlsx, .xls, .csv — maks 10 MB, 5.000 baris</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => handleFile(e.target.files[0])} />
      </div>
    </div>
  );

  // ── Step 2: Preview ────────────────────────────────────────────────────────
  if (step === 2) return (
    <div className="p-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-800 text-sm">← Kembali</button>
        <h2 className="text-base font-semibold text-gray-800">Preview — {fileName}</h2>
        <span className="ml-auto text-xs text-gray-500">{rows.length} baris valid</span>
      </div>

      {parseErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-xs text-yellow-800">
          <p className="font-semibold mb-1">⚠ {parseErrors.length} baris dilewati saat parsing:</p>
          {parseErrors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
          {parseErrors.length > 5 && <p>…dan {parseErrors.length - 5} lainnya</p>}
        </div>
      )}

      <div className="overflow-auto border rounded-lg mb-4" style={{ maxHeight: 420 }}>
        <table className="w-full text-xs">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">#</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Barcode</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Stok Baru</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Tenant</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono text-gray-800">{r.barcode}</td>
                <td className="px-3 py-1.5 text-right text-gray-800">{r.stock_quantity}</td>
                <td className="px-3 py-1.5 text-gray-700">{r.tenant || <span className="text-gray-400 italic">kosong</span>}</td>
              </tr>
            ))}
            {rows.length > 200 && (
              <tr><td colSpan={4} className="px-3 py-2 text-center text-xs text-gray-400">…{rows.length - 200} baris lainnya tidak ditampilkan</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => setStep(1)}>Ganti File</Button>
        <Button onClick={handleSubmit} disabled={submitting || rows.length === 0}>
          {submitting ? '⟳ Memproses…' : `Proses ${rows.length} Baris`}
        </Button>
      </div>
    </div>
  );

  // ── Step 3: Result ─────────────────────────────────────────────────────────
  const s = result?.summary ?? {};
  return (
    <div className="p-6 max-w-xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h2 className="text-base font-semibold text-gray-800 mb-5">Hasil Update</h2>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: 'Total Baris', val: s.total,            color: 'bg-gray-50 border-gray-200' },
          { label: 'Berhasil Diupdate', val: s.updated,    color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Barcode Tidak Ditemukan', val: s.not_found,       color: s.not_found > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200' },
          { label: 'Tenant Tidak Cocok', val: s.tenant_not_found,     color: s.tenant_not_found > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-gray-50 border-gray-200' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`border rounded-lg p-3 text-center ${color}`}>
            <div className="text-2xl font-bold">{val ?? 0}</div>
            <div className="text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {result?.details?.tenantNotFound?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-xs text-yellow-800">
          <p className="font-semibold mb-1">⚠ Tenant tidak ditemukan (stok tetap diupdate, tenant tidak berubah):</p>
          {result.details.tenantNotFound.slice(0, 10).map((x, i) =>
            <p key={i}>Baris {x.row}: barcode <code>{x.barcode}</code> → tenant "<em>{x.tenant}</em>"</p>
          )}
          {result.details.tenantNotFound.length > 10 && <p>…dan {result.details.tenantNotFound.length - 10} lainnya</p>}
        </div>
      )}

      {result?.details?.notFound?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-800">
          <p className="font-semibold mb-1">✗ Barcode tidak ditemukan di database:</p>
          {result.details.notFound.slice(0, 10).map((x, i) =>
            <p key={i}>Baris {x.row}: <code>{x.barcode}</code></p>
          )}
          {result.details.notFound.length > 10 && <p>…dan {result.details.notFound.length - 10} lainnya</p>}
        </div>
      )}

      <div className="flex gap-3 justify-end mt-4">
        <Button variant="outline" onClick={() => { setStep(1); setRows([]); setResult(null); }}>
          Upload File Lain
        </Button>
        <Button onClick={() => { onDone?.(); onBack?.(); }}>
          Selesai
        </Button>
      </div>
    </div>
  );
}
