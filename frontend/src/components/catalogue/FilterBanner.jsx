import React from 'react';

export default function FilterBanner({ selectedStores, onClear }) {
  return (
    <div className="mx-4 mb-2 bg-[#E1F5EE] border border-[#5DCAA5] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-[#085041] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span className="flex-1 text-xs font-medium text-[#085041]">
          {selectedStores.length} store{selectedStores.length > 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClear}
          aria-label="Clear store selection"
          className="p-0.5 rounded hover:bg-[#c6ead9] transition-colors"
        >
          <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selectedStores.map(s => (
          <span key={s.id} className="text-[10px] bg-[#085041] text-[#E1F5EE] px-2 py-0.5 rounded">
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
