import React from 'react';
import StoreCard from './StoreCard';
import { useLang } from '../../context/LangContext';

export default function StoreList({ stores, selectedIds, onToggle }) {
  const { t } = useLang();
  if (stores.length === 0) {
    return (
      <div className="py-10 text-center px-4">
        <div className="text-4xl mb-3">🏪</div>
        <p className="text-sm font-medium text-gray-700 mb-1">{t('browse.noStores')}</p>
        <p className="text-xs text-gray-400">{t('browse.tryOtherFloor')}</p>
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
