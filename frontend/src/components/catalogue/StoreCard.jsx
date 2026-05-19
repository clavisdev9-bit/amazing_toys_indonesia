import React from 'react';

export default function StoreCard({ store, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(store.id)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-[120ms]
        ${selected
          ? 'border-[#5DCAA5] border-[1.5px] bg-[#f0fdf8]'
          : 'border-gray-200 bg-white hover:bg-gray-50'}`}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
        style={{ background: store.colorHex }}
      >
        🏪
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{store.name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{store.meta}</p>
      </div>

      {/* Floor badge */}
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0"
        style={{ background: store.colorHex, color: store.textColorHex }}
      >
        {store.floor}
      </span>

      {/* Checkbox */}
      <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-[120ms]
        ${selected ? 'bg-[#1D9E75] border-[#1D9E75]' : 'border-gray-300'}`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}
