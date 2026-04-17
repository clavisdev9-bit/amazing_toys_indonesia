import React from 'react';

const styles = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  info:    'bg-blue-600',
  warning: 'bg-amber-500',
};

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${styles[t.type] ?? styles.info}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-75 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
}
