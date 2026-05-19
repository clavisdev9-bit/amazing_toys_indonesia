import React from 'react';

export default function QuantitySelector({ value, min = 1, max, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center text-lg font-medium text-gray-600 disabled:text-gray-300 rounded-lg transition-colors hover:bg-gray-200 disabled:hover:bg-transparent"
        aria-label="Kurangi"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold text-gray-800 select-none">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 flex items-center justify-center text-lg font-medium text-gray-600 disabled:text-gray-300 rounded-lg transition-colors hover:bg-gray-200 disabled:hover:bg-transparent"
        aria-label="Tambah"
      >
        +
      </button>
    </div>
  );
}
