import React from 'react';
import { useLang } from '../../context/LangContext';

const styles = {
  PENDING:      'bg-yellow-100 text-yellow-800',
  PAID:         'bg-blue-100 text-blue-800',
  DONE:         'bg-green-100 text-green-800',
  CANCELLED:    'bg-red-100 text-red-800',
  EXPIRED:      'bg-gray-100 text-gray-600',
  AVAILABLE:    'bg-green-100 text-green-700',
  LOW_STOCK:    'bg-orange-100 text-orange-700',
  OUT_OF_STOCK: 'bg-red-100 text-red-700',
  APPROVED:     'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
  READY:        'bg-yellow-100 text-yellow-800',
  PREPARING:    'bg-gray-100 text-gray-500',
};

export default function Badge({ status, label, className = '' }) {
  const { t } = useLang();
  const display = label ?? t(`badge.${status}`) ?? status;
  const style   = styles[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}>
      {display}
    </span>
  );
}
