// Verificación del escaneo firmado por el teléfono (presente en aula, ingreso a sede).
// Prueba que quien escaneó el QR es el dispositivo vinculado: el JWS está firmado con su
// clave privada, que nunca sale del teléfono. Lógica pura (testeable sin base).
import { base64url, decodificarJws, TYP_ESCANEO, type PayloadEscaneo } from '@presente/shared';

/** Diferencia máxima entre la hora del escaneo (`ts`) y la del servidor. */
export const VENTANA_ESCANEO_S = 30;

export type ResultadoEscaneo = { ok: true; payload: PayloadEscaneo } | { ok: false; motivo: string };

export function verificarEscaneoFirmado(
  jws: string,
  dispositivo: { deviceId: string; publicKey: string },
  ahoraSeg: number,
): ResultadoEscaneo {
  const d = decodificarJws<Partial<PayloadEscaneo>>(jws);
  if (!d || d.header.typ !== TYP_ESCANEO) return { ok: false, motivo: 'Escaneo mal formado' };
  const p = d.payload;
  if (typeof p.qr !== 'string' || typeof p.did !== 'string' || typeof p.nonce !== 'string' || p.nonce.length < 16 || !Number.isInteger(p.ts)) {
    return { ok: false, motivo: 'Escaneo mal formado' };
  }
  if (p.did !== dispositivo.deviceId) return { ok: false, motivo: 'El escaneo no corresponde a este dispositivo' };
  if (!d.verificar(base64url.decode(dispositivo.publicKey))) return { ok: false, motivo: 'La firma del dispositivo no es válida' };
  if (Math.abs(ahoraSeg - p.ts!) > VENTANA_ESCANEO_S) return { ok: false, motivo: 'La hora del escaneo está fuera de rango' };
  return { ok: true, payload: p as PayloadEscaneo };
}
