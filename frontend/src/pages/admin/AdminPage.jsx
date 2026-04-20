import { useState } from 'react';
import ErrorBoundary  from '../../components/ErrorBoundary';
import MasterDataTab  from './tabs/MasterDataTab';
import UserRoleTab    from './tabs/UserRoleTab';
import BoothTab       from './tabs/BoothTab';
import AuditLogTab    from './tabs/AuditLogTab';
import ConfigTab      from './tabs/ConfigTab';
import IntegrationTab from './tabs/IntegrationTab';

const TABS = [
  { key: 'master-data', label: 'Master Data', icon: '📦', active: 'bg-blue-600 text-white shadow',   desc: 'Kelola produk & foto' },
  { key: 'user-role',   label: 'User & Role',  icon: '👥', active: 'bg-violet-600 text-white shadow', desc: 'Buat & atur akun user' },
  { key: 'booth',       label: 'Booth Tenant', icon: '🏪', active: 'bg-emerald-600 text-white shadow',desc: 'Kelola data booth & kontak' },
  { key: 'config',      label: 'Konfigurasi',  icon: '⚙️',  active: 'bg-amber-500 text-white shadow',  desc: 'Setup event & logo' },
  { key: 'audit-log',   label: 'Audit Log',    icon: '📋', active: 'bg-slate-600 text-white shadow',  desc: 'Monitor aktivitas' },
  { key: 'integration', label: 'Integrasi',    icon: '🔌', active: 'bg-teal-600 text-white shadow',   desc: 'Payment API & Integration with Odoo' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('master-data');
  const current = TABS.find((t) => t.key === tab);

  return (
    <div className="max-w-6xl">

      {/* ── Colored header banner ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-600 to-blue-500 rounded-2xl px-6 py-5 mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0">
            🛡️
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">Administrator Panel</h1>
            <p className="text-blue-200 text-sm mt-0.5">Full Access — Amazing Toys Fair 2026</p>
          </div>
          <div className="hidden sm:block text-right shrink-0">
            <p className="text-xs text-blue-300 uppercase tracking-wide">Modul aktif</p>
            <p className="text-white font-semibold text-sm mt-0.5">
              {current?.icon} {current?.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Colored pill tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              whitespace-nowrap transition-all duration-150
              ${tab === t.key ? t.active : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sub-description ───────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 mb-5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
        {current?.desc}
      </p>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <ErrorBoundary key={tab}>
        {tab === 'master-data' && <MasterDataTab />}
        {tab === 'user-role'   && <UserRoleTab />}
        {tab === 'booth'       && <BoothTab />}
        {tab === 'config'      && <ConfigTab />}
        {tab === 'audit-log'   && <AuditLogTab />}
        {tab === 'integration' && <IntegrationTab />}
      </ErrorBoundary>
    </div>
  );
}
