import { useState, useEffect } from 'react';
import { getOdooCategories } from '../api/admin';

export function useOdooProductCategories() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getOdooCategories()
      .then(r => {
        if (!cancelled) {
          setCategories(r.data.data ?? []);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[useOdooProductCategories]', err.response?.data?.message || err.message);
          setError('Gagal memuat Kategori Odoo. Silakan coba lagi atau hubungi administrator.');
          setCategories([]);
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { categories, isLoading, error };
}
