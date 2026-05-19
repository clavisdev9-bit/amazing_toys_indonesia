import React from 'react';
import StoreCard from './StoreCard';

export default function StoreList({ stores, selectedIds, onToggle }) {
  if (stores.length === 0) {
    return (
      <div className="py-10 text-center px-4">
        <div className="text-4xl mb-3">🏪</div>
        <p className="text-sm font-medium text-gray-700 mb-1">No stores on this floor</p>
        <p className="text-xs text-gray-400">Try a different floor</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {stores.map(store => (
        <StoreCard
          key={store.id}
          store={store}
          selected={selectedIds.includes(store.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
