import React from 'react';

export default function StickyActionBar({ count, onView }) {
  return (
    <button
      onClick={onView}
      className="mx-4 mb-3 w-[calc(100%-2rem)] flex items-center justify-between px-4 py-3 rounded-[14px] border-none cursor-pointer transition-all duration-150"
      style={{
        background: 'rgba(59,91,219,0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(116,143,252,0.40)',
        boxShadow: '0 4px 16px rgba(59,91,219,0.30), inset 0 1px 0 rgba(255,255,255,0.18)',
      }}
    >
      <div className="text-left">
        <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Lihat produk toko yang dipilih</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(200,215,255,0.80)' }}>
          {count} produk tersedia
        </p>
      </div>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="rgba(200,215,255,0.90)" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
