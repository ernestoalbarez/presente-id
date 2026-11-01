// Formato de los QR firmados por el teléfono.
import { ROTACION_QR_IDENTIDAD_S } from './constants';
import { base64url } from './crypto/ed25519';
import { firmarJws } from './crypto/jws';

/** `typ` del JWS del QR de identidad: impide usar otro token firmado por el teléfono en su lugar. */
export const TYP_QR_IDENTIDAD = 'presente-id+jws';

/** `typ` del JWS que firma el teléfono al escanear un QR (asistencia o puerta). */
export const TYP_ESCANEO = 'presente-escaneo+jws';

/** `typ` de los QR que genera el servidor. La app lo lee del header para saber qué escaneó. */
export const TYP_QR_ASISTENCIA = 'presente-asistencia+jwt';
export const TYP_QR_PUERTA = 'presente-puerta+jwt';

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

/** Payload del escaneo firmado que el teléfono envía al servidor. */
export interface PayloadEscaneo {
  qr: string; // contenido del QR escaneado (token del servidor)
  did: string; // deviceId
  ts: number; // momento del escaneo (segundos epoch, hora del servidor)
  nonce: string;
}

/**
 * Envuelve el QR escaneado en un JWS firmado por el teléfono: prueba que el escaneo lo hizo
 * el dispositivo vinculado (y no alguien que copió el token del QR a otro lado).
 */
export function firmarEscaneo(params: {
  qr: string;
  deviceId: string;
  ahoraSeg: number;
  nonce: string;
  clavePrivada: Uint8Array;
}): string {
  const payload: PayloadEscaneo = { qr: params.qr, did: params.deviceId, ts: params.ahoraSeg, nonce: params.nonce };
  return firmarJws(TYP_ESCANEO, payload, params.clavePrivada);
}

/** Lee el `typ` del header de un JWS sin verificarlo (para decidir a qué endpoint mandarlo). */
export function tipoDeQr(contenido: string): string | null {
  const partes = contenido.trim().split('.');
  if (partes.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64url.decode(partes[0])));
    return typeof header?.typ === 'string' ? header.typ : null;
  } catch {
    return null;
  }
}
