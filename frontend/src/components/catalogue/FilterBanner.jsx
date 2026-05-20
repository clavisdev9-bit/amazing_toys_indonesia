import React from 'react';

export default function FilterBanner({ selectedStores, onClear }) {
  return (
    <div
      className="mx-4 mb-2 px-3 py-2.5 rounded-[12px]"
      style={{
        background: 'rgba(59,91,219,0.10)',
        border: '1.5px solid rgba(116,143,252,0.40)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#3B5BDB" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span className="flex-1 text-xs font-semibold" style={{ color: '#3B5BDB' }}>
          {selectedStores.length} toko dipilih
        </span>
        <button
          onClick={onClear}
          aria-label="Clear store selection"
          className="p-0.5 rounded-md transition-colors hover:bg-white/40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#3B5BDB" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selectedStores.map(s => (
          <span
            key={s.id}
            className="text-[10px] font-bold px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(59,91,219,0.88)', color: '#fff' }}
          >
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
