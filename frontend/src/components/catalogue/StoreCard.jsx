import React from 'react';

export default function StoreCard({ store, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(store.id)}
      className="w-full flex items-center gap-3 p-3 rounded-[12px] text-left transition-all duration-[120ms] border-none cursor-pointer"
      style={
        selected
          ? { background: 'rgba(59,91,219,0.10)', border: '1.5px solid rgba(116,143,252,0.50)', boxShadow: '0 2px 10px rgba(59,91,219,0.08)' }
          : {
              background: 'rgba(255,255,255,0.48)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(255,255,255,0.75)',
              boxShadow: '0 2px 10px rgba(100,130,220,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            }
      }
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-lg"
        style={{ background: store.colorHex || '#EEF2FF' }}
      >
        🏪
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(25,35,90,0.90)' }}>{store.name}</p>
        <p className="text-[11px] font-medium mt-0.5 truncate" style={{ color: 'rgba(80,95,160,0.70)' }}>{store.meta}</p>
      </div>

      {/* Floor badge */}
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
        style={{ background: store.colorHex || '#EEF2FF', color: store.textColorHex || '#3B5BDB' }}
      >
        {store.floor}
      </span>

      {/* Checkbox */}
      <div
        className="w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-[120ms]"
        style={selected ? { background: '#3B5BDB', borderColor: '#3B5BDB' } : { borderColor: '#ADB5BD' }}
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
