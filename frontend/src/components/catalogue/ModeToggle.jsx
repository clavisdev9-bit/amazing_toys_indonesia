import React from 'react';

const GLASS_PANEL = {
  background: 'rgba(255,255,255,0.45)',
  backdropFilter: 'blur(16px) saturate(1.7)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.7)',
  border: '1.5px solid rgba(255,255,255,0.72)',
  borderRadius: 14,
  padding: 4,
  boxShadow: '0 2px 12px rgba(100,130,220,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
};

export default function ModeToggle({ mode, onSetMode }) {
  return (
    <div style={GLASS_PANEL} className="flex gap-1">
      <button
        onClick={() => onSetMode('product')}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[13px] font-semibold transition-all duration-200 border-none cursor-pointer"
        style={
          mode === 'product'
            ? { background: 'rgba(255,255,255,0.75)', color: '#3B5BDB', boxShadow: '0 1px 6px rgba(100,130,220,0.12)' }
            : { background: 'transparent', color: 'rgba(80,90,140,0.75)' }
        }
      >
        🏷️ By product
      </button>
      <button
        onClick={() => onSetMode('store')}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[13px] font-semibold transition-all duration-200 border-none cursor-pointer"
        style={
          mode === 'store'
            ? { background: 'rgba(255,255,255,0.75)', color: '#3B5BDB', boxShadow: '0 1px 6px rgba(100,130,220,0.12)' }
            : { background: 'transparent', color: 'rgba(80,90,140,0.75)' }
        }
      >
        🏪 By store
      </button>
    </div>
  );
}
