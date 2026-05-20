import React from 'react';

const CHIP_BASE = {
  padding: '7px 16px',
  borderRadius: 20,
  border: '1.5px solid rgba(255,255,255,0.70)',
  background: 'rgba(255,255,255,0.42)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(70,80,140,0.85)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  boxShadow: '0 1px 6px rgba(100,130,220,0.07), inset 0 1px 0 rgba(255,255,255,0.7)',
  transition: 'all 0.2s',
  fontFamily: 'inherit',
};

const CHIP_ACTIVE = {
  background: 'rgba(59,91,219,0.88)',
  border: '1.5px solid rgba(116,143,252,0.50)',
  color: '#fff',
  boxShadow: '0 3px 12px rgba(59,91,219,0.30)',
};

export default function CategoryChips({ selected, onSelect, categories = [], forwardRef }) {
  return (
    <div ref={forwardRef} className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2">
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          style={selected === cat ? { ...CHIP_BASE, ...CHIP_ACTIVE } : CHIP_BASE}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
