import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Button from '../../components/ui/Button';
import ToastContainer from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { adminBulkUploadTenants } from '../../api/admin';

// ── Kolom template ────────────────────────────────────────────────────────────

const HEADERS = [
  'tenant_name', 'booth_location', 'floor_label',
  'contact_name', 'contact_phone', 'contact_email', 'order_mode',
];

const REQUIRED_FIELDS = ['tenant_name', 'booth_location', 'contact_name', 'contact_phone'];

const FIELD_DESCS = {
  tenant_name:    '* WAJIB – Nama booth / tenant',
  booth_location: '* WAJIB – Lokasi booth (cth: Hall A, Stand A1)',
  floor_label:    'Label lantai, opsional (cth: GF / LG / L1)',
  contact_name:   '* WAJIB – Nama PIC kontak',
  contact_phone:  '* WAJIB – No. HP kontak (cth: 08xxxxxxxxxx)',
  contact_email:  'Email kontak, opsional',
  order_mode:     'Mode penjualan: HELPER_INPUT / SELF_ORDER / kosongkan = ikuti global',
};

const EXAMPLE_ROW = {
  tenant_name:    'ToysWorld',
  booth_location: 'Hall A, Stand A1',
  floor_label:    'GF',
  contact_name:   'Budi Santoso',
  contact_phone:  '081234567890',
  contact_email:  'budi@toysworld.com',
  order_mode:     'SELF_ORDER',
};

const ORDER_MODES = ['', 'HELPER_INPUT', 'SELF_ORDER'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateRow(row, idx) {
  const errs = [];
  REQUIRED_FIELDS.forEach((f) => {
    if (!row[f] || String(row[f]).trim() === '')
      errs.push(`${f} wajib diisi`);
  });
  if (row.order_mode && !ORDER_MODES.includes(String(row.order_mode).trim()))
    errs.push(`order_mode harus HELPER_INPUT / SELF_ORDER / kosong`);
  return errs.length ? { row: idx + 2, errors: errs } : null;
}

function parseSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return raw.map((r) => {
    const obj = {};
    HEADERS.forEach((h) => { obj[h] = r[h] !== undefined ? String(r[h]).trim() : ''; });
    return obj;
  });
}

// ── Komponen utama ────────────────────────────────────────────────────────────

export default function BoothBulkUpload({ onBack }) {
  const { toasts, addToast, removeToast } = useToast();
  const [step, setStep]       = useState(1); // 1=upload, 2=preview, 3=done
  const [rows, setRows]       = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]   = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ── Download template ───────────────────────────────────────────────────────
  function handleDownloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([EXAMPLE_ROW], { header: HEADERS });

    // Kolom info (baris ke-3)
    const infoRow = {};
    HEADERS.forEach((h) => { infoRow[h] = FIELD_DESCS[h]; });
    XLSX.utils.sheet_add_json(ws, [infoRow], { header: HEADERS, skipHeader: true, origin: 'A3' });

    // Lebar kolom otomatis
    ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length, 20) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Booth');
    XLSX.writeFile(wb, 'template_bulk_booth.xlsx');
  }

  // ── Parse file ──────────────────────────────────────────────────────────────
  const processFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      addToast('Format tidak didukung. Gunakan .xlsx, .xls, atau .csv', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const parsed = parseSheet(wb).filter((r) =>
          HEADERS.some((h) => r[h] !== '')
        );
        if (parsed.length === 0) { addToast('File kosong atau format tidak sesuai template.', 'error'); return; }

        const errs = parsed.map((r, i) => validateRow(r, i)).filter(Boolean);
        setRows(parsed);
        setRowErrors(errs);
        setStep(2);
      } catch {
        addToast('Gagal membaca file. Pastikan format sesuai template.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onFileChange(e) { processFile(e.target.files[0]); e.target.value = ''; }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (rowErrors.length > 0) { addToast('Perbaiki error sebelum upload.', 'error'); return; }
    setUploading(true);
    try {
      const r = await adminBulkUploadTenants(rows);
      setResult(r.data.data);
      setStep(3);
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal upload data booth.', 'error');
    } finally {
      setUploading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white mb-6">
        <span className="text-base">🏪</span>
        <h2 className="text-sm font-semibold flex-1">Upload Massal Booth</h2>
        <Button size="sm" onClick={onBack}
          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
          ← Kembali
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {[['1','Upload File'],['2','Preview & Validasi'],['3','Selesai']].map(([n, label], i) => (
          <React.Fragment key={n}>
            {i > 0 && <div className="h-px flex-1 bg-gray-200" />}
            <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= Number(n) ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                ${step > Number(n) ? 'bg-emerald-600 text-white' : step === Number(n) ? 'border-2 border-emerald-600 text-emerald-600' : 'border-2 border-gray-300 text-gray-400'}`}>
                {step > Number(n) ? '✓' : n}
              </span>
              {label}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="space-y-6 max-w-xl">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-emerald-800 mb-2">Langkah 1 — Download template</h3>
            <p className="text-xs text-emerald-700 mb-3">
              Download template Excel, isi data booth sesuai format, lalu upload kembali.
            </p>
            <Button onClick={handleDownloadTemplate} size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              ⬇ Download Template (.xlsx)
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Langkah 2 — Upload file</h3>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'}`}>
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-gray-600 font-medium">Drag & drop file di sini atau klik untuk pilih</p>
              <p className="text-xs text-gray-400 mt-1">Format: .xlsx, .xls, .csv</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
          </div>

          {/* Field reference */}
          <div className="bg-gray-50 rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Kolom yang tersedia:</p>
            <div className="space-y-1">
              {HEADERS.map((h) => (
                <div key={h} className="flex gap-2 text-xs">
                  <span className="font-mono text-violet-700 w-32 shrink-0">{h}</span>
                  <span className="text-gray-500">{FIELD_DESCS[h]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-700">{rows.length} booth siap diupload</p>
              {rowErrors.length > 0 && (
                <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {rowErrors.length} error
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setStep(1)}>← Upload Ulang</Button>
              <Button size="sm"
                onClick={handleSubmit}
                loading={uploading}
                disabled={rowErrors.length > 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                ✓ Upload {rows.length} Booth
              </Button>
            </div>
          </div>

          {rowErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {rowErrors.map((e) => (
                <p key={e.row} className="text-xs text-red-700">
                  <span className="font-semibold">Baris {e.row}:</span> {e.errors.join(', ')}
                </p>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                    {HEADERS.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const err = rowErrors.find((e) => e.row === i + 2);
                    return (
                      <tr key={i} className={`border-b last:border-0 ${err ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        {HEADERS.map((h) => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">
                            {r[h] || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {err
                            ? <span className="text-red-600 font-medium">✗ {err.errors[0]}</span>
                            : <span className="text-emerald-600 font-medium">✓ OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 3 && result && (
        <div className="max-w-md text-center space-y-4 mx-auto pt-4">
          <div className="text-5xl">🎉</div>
          <h3 className="text-lg font-bold text-gray-800">Upload Berhasil!</h3>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-emerald-600">{result.created} booth</span> berhasil ditambahkan.
          </p>
          <div className="bg-gray-50 rounded-xl border p-3 text-left max-h-48 overflow-y-auto">
            {result.tenants.map((t) => (
              <div key={t.tenant_id} className="flex items-center gap-2 py-1 text-xs border-b last:border-0">
                <span className="font-mono text-gray-400 w-12">{t.tenant_id}</span>
                <span className="font-medium text-gray-700">{t.tenant_name}</span>
                <span className="text-gray-400">{t.booth_location}</span>
              </div>
            ))}
          </div>
          <Button onClick={onBack} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
            ← Kembali ke Daftar Booth
          </Button>
        </div>
      )}
    </>
  );
}
