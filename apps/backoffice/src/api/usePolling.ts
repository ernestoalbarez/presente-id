import { useCallback, useEffect, useRef, useState } from 'react';
import { POLLING_MS } from '@presente/shared';
import { api } from './client';

/** GET periódico cada POLLING_MS ("tiempo real" por polling). `recargar` fuerza un refresco inmediato. */
export function usePolling<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  const recargar = useCallback(async () => {
    try {
      const r = await api<T>(path);
      if (vivo.current) {
        setData(r);
        setError(null);
      }
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [path]);

  useEffect(() => {
    vivo.current = true;
    void recargar();
    const id = setInterval(recargar, POLLING_MS);
    return () => {
      vivo.current = false;
      clearInterval(id);
    };
  }, [recargar]);

  return { data, error, recargar };
}
