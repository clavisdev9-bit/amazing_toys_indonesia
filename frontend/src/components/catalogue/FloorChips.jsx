import React from 'react';
import { FLOORS } from '../../data/mockData';

export default function FloorChips({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2">
      {FLOORS.map(floor => (
        <button
          key={floor}
          onClick={() => onSelect(floor)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-[120ms]
            ${selected === floor
              ? 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
        >
          {floor}
        </button>
      ))}
    </div>
  );
}
