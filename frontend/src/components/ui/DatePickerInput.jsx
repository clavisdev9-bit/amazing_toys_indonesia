import React, { useState, useMemo } from 'react';

const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

function daysInMonth(month, year) {
  if (!month) return 31;
  return new Date(year || 2000, parseInt(month), 0).getDate();
}

function parseISO(iso) {
  if (!iso) return { day: '', month: '', year: '' };
  const [y, m, d] = iso.split('-');
  return {
    year:  y  || '',
    month: m  ? parseInt(m).toString() : '',
    day:   d  ? parseInt(d).toString() : '',
  };
}

/**
 * Segmented date picker (DD / MM / YYYY).
 *
 * Internal state holds the three parts independently so partial selections
 * survive re-renders of the parent (the previous bug: deriving day/month/year
 * from the value prop caused the parent's '' reset to erase each pick).
 *
 * onChange fires with an ISO string ("YYYY-MM-DD") when all three parts are
 * set, or with "" when any part is cleared.
 */
export default function DatePickerInput({
  label,
  name,
  value,
  onChange,
  required,
  hint,
  error,
}) {
  // Own state — not derived from value prop to preserve partial selections.
  const [parts, setParts] = useState(() => parseISO(value));
  const { day, month, year } = parts;

  const maxDay = useMemo(() => daysInMonth(month, year), [month, year]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - 1939 }, (_, i) => now - i);
  }, []);

  function update(field, val) {
    const next = { ...parts, [field]: val };

    // Clamp day when month/year change reduces the number of valid days.
    if (next.day && next.month && next.year) {
      const max = daysInMonth(parseInt(next.month), parseInt(next.year));
      if (parseInt(next.day) > max) next.day = String(max);
    }

    setParts(next);

    const iso =
      next.day && next.month && next.year
        ? `${next.year}-${String(next.month).padStart(2, '0')}-${String(next.day).padStart(2, '0')}`
        : '';
    onChange({ target: { name, value: iso } });
  }

  const sel =
    'flex-1 min-w-0 bg-transparent border-none text-sm focus:outline-none cursor-pointer py-1.5 text-gray-700';
  const boxClass = `flex items-center gap-1 border rounded-lg px-3 py-0.5 bg-white transition-shadow
    focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
    ${error ? 'border-red-400' : 'border-gray-300'}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className={boxClass}>
        {/* Calendar icon */}
        <svg
          className="w-4 h-4 text-gray-400 shrink-0 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        {/* Day */}
        <select
          value={day}
          onChange={e => update('day', e.target.value)}
          className={sel}
          aria-label="Tanggal"
        >
          <option value="">DD</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
          ))}
        </select>

        <span className="text-gray-300 select-none">/</span>

        {/* Month */}
        <select
          value={month}
          onChange={e => update('month', e.target.value)}
          className={sel}
          aria-label="Bulan"
        >
          <option value="">MM</option>
          {MONTHS_ID.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        <span className="text-gray-300 select-none">/</span>

        {/* Year */}
        <select
          value={year}
          onChange={e => update('year', e.target.value)}
          className={sel}
          aria-label="Tahun"
        >
          <option value="">YYYY</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error  && <p className="text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
