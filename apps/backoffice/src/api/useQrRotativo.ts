import { useEffect, useState } from 'react';
import { api } from './client';

/**
 * Pide un QR a `path` y, si la respuesta trae `rotaEnSeg`, vuelve a pedirlo cada esos segundos.
 * Sirve para el QR de asistencia de una sesión y para los QR de puerta (estáticos o rotativos).
 */
export function useQrRotativo<T extends { qr: string; rotaEnSeg?: number }>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    let vence = Infinity;
    let cancelado = false;
    const pedir = async () => {
      try {
        const r = await api<T>(path);
        if (cancelado) return;
        setData(r);
        vence = r.rotaEnSeg ? Date.now() + r.rotaEnSeg * 1000 : Infinity;
      } catch {
        vence = Date.now() + 3000; // reintento
      }
    };
    void pedir();
    const id = setInterval(() => {
      if (vence === Infinity) return;
      const s = Math.ceil((vence - Date.now()) / 1000);
      setRestante(Math.max(s, 0));
      if (s <= 0) void pedir();
    }, 1000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [path]);

  return { data, restante };
}
