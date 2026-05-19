import React from 'react';
import { CATEGORIES } from '../../data/mockData';

const ACTIVE_PRODUCT = 'bg-[#EEEDFE] text-[#3C3489] border-[#AFA9EC]';
const ACTIVE_STORE   = 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]';
const INACTIVE       = 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50';

export default function CategoryChips({ selected, onSelect, variant = 'product', forwardRef }) {
  const activeClass = variant === 'store' ? ACTIVE_STORE : ACTIVE_PRODUCT;

  return (
    <div ref={forwardRef} className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 -mx-4 px-4">
      {CATEGORIES.map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-[120ms]
            ${selected === cat ? activeClass : INACTIVE}`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
