import { useEffect, useRef } from 'react';
import { POLLING_MS } from '@presente/shared';

/** Ejecuta `fn` cada POLLING_MS mientras `activo` sea true ("tiempo real" por polling). */
export function usePolling(fn: () => void | Promise<void>, activo = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => void ref.current(), POLLING_MS);
    return () => clearInterval(id);
  }, [activo]);
}
