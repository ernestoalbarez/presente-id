// Formato de los QR firmados por el teléfono.
import { ROTACION_QR_IDENTIDAD_S } from './constants';
import { firmarJws } from './crypto/jws';

/** `typ` del JWS del QR de identidad: impide usar otro token firmado por el teléfono en su lugar. */
export const TYP_QR_IDENTIDAD = 'presente-id+jws';

/** Payload del QR de identidad que muestra el estudiante. */
export interface PayloadQrIdentidad {
  sub: string; // usuarioId
  did: string; // deviceId
  iat: number; // emitido (segundos epoch)
  exp: number; // vence (iat + 30)
  nonce: string; // aleatorio, de un solo uso
}

/**
 * Genera el contenido del QR de identidad. Lo firma la clave privada del teléfono, así que
 * se genera sin conexión. `ahoraSeg` debería venir corregido con la hora del servidor.
 */
export function generarQrIdentidad(params: {
  usuarioId: string;
  deviceId: string;
  ahoraSeg: number;
  nonce: string;
  clavePrivada: Uint8Array;
}): { qr: string; exp: number } {
  const iat = params.ahoraSeg;
  const exp = iat + ROTACION_QR_IDENTIDAD_S;
  const payload: PayloadQrIdentidad = { sub: params.usuarioId, did: params.deviceId, iat, exp, nonce: params.nonce };
  return { qr: firmarJws(TYP_QR_IDENTIDAD, payload, params.clavePrivada), exp };
}
