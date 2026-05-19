import React from 'react';

export default function StickyActionBar({ count, onView }) {
  return (
    <button
      onClick={onView}
      className="mx-4 mb-3 w-[calc(100%-2rem)] flex items-center justify-between bg-[#1D9E75] rounded-xl px-4 py-3 hover:bg-[#178a65] transition-colors"
    >
      <div className="text-left">
        <p className="text-xs font-medium text-[#E1F5EE]">View products in selected stores</p>
        <p className="text-[11px] text-[#9FE1CB] mt-0.5">
          {count} product{count !== 1 ? 's' : ''} available
        </p>
      </div>
      <svg className="w-5 h-5 text-[#9FE1CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
