import { useState, useEffect } from 'react';
import { getPublicConfig } from '../api/admin';

// ── Shared module-level cache — one fetch per page load ───────────────────────

let cached  = null;
let pending = null;

function fetchCached() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = getPublicConfig()
      .then((r) => { cached = r.data.data; })
      .catch(() => { cached = {}; })
      .finally(() => { pending = null; });
  }
  return pending.then(() => cached ?? {});
}

// ── useAppLogo — backward-compatible, returns logo URL only ──────────────────

export function useAppLogo() {
  const [logoUrl, setLogoUrl] = useState(cached?.logo_url ?? null);
  useEffect(() => {
    fetchCached().then((c) => setLogoUrl(c.logo_url ?? null));
  }, []);
  return logoUrl;
}

// ── usePublicConfig — returns full public config object ───────────────────────

export function usePublicConfig() {
  const [config, setConfig] = useState(cached ?? null);
  useEffect(() => {
    fetchCached().then((c) => setConfig(c));
  }, []);
  return config;
}

// ── bustPublicConfigCache — forces a fresh fetch on next use ──────────────────

export function bustPublicConfigCache() {
  cached  = null;
  pending = null;
}
