import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';

const clientMemoryCache = new Map<string, any>();

/**
 * Menghapus cache memory client (misal saat logout atau refresh total)
 */
export function clearClientCache() {
  clientMemoryCache.clear();
}

/**
 * Hook asynchronous data loader dengan kapabilitas Stale-While-Revalidate (SWR).
 * Halaman yang pernah dibuka akan langsung dirender seketika (0 milidetik / sat-set)
 * menggunakan cache in-memory tanpa memblokir antarmuka dengan spinner berulang.
 */
export function useAsyncData<T>(loader: () => Promise<T>, cacheKey?: string) {
  const key = cacheKey || loader.toString().slice(0, 120);
  const cached = clientMemoryCache.get(key) as T | undefined;

  const [data, setData] = useState<T | null>(() => (cached !== undefined ? cached : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => cached === undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (clientMemoryCache.get(key) === undefined) {
      setLoading(true);
    }

    loader()
      .then((result) => {
        if (cancelled) return;
        clientMemoryCache.set(key, result);
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, version, key]);

  return {
    data,
    error,
    loading,
    reload: () => {
      clientMemoryCache.delete(key);
      setVersion((current) => current + 1);
    },
  };
}
