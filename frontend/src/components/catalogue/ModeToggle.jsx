import React from 'react';

export default function ModeToggle({ mode, onSetMode }) {
  return (
    <div className="flex bg-gray-100 rounded-xl p-1 border border-gray-200">
      <button
        onClick={() => onSetMode('product')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
          ${mode === 'product'
            ? 'bg-[#EEEDFE] text-[#3C3489] shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
        By product
      </button>
      <button
        onClick={() => onSetMode('store')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
          ${mode === 'store'
            ? 'bg-[#E1F5EE] text-[#085041] shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        By store
      </button>
    </div>
  );
}
