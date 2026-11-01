// Utilidades Ed25519 compartidas por la app (genera y usa la clave del dispositivo) y la API
// (verifica firmas con la clave pública registrada). Usa @noble/ed25519, que es JS puro:
// funciona en Expo Go sin módulos nativos.
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';

// noble necesita una implementación sincrónica de SHA-512 para las funciones sync.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url sin padding (RFC 4648 §5). Implementación propia porque React Native no tiene Buffer. */
export const base64url = {
  encode(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
      out += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
      if (i + 1 < bytes.length) out += ALFABETO[(n >> 6) & 63];
      if (i + 2 < bytes.length) out += ALFABETO[n & 63];
    }
    return out;
  },
  decode(str: string): Uint8Array {
    const limpio = str.replace(/=+$/, '');
    if (/[^A-Za-z0-9\-_]/.test(limpio)) throw new Error('base64url inválido');
    const out: number[] = [];
    for (let i = 0; i < limpio.length; i += 4) {
      const c = [0, 1, 2, 3].map((j) => (i + j < limpio.length ? ALFABETO.indexOf(limpio[i + j]) : 0));
      const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
      out.push((n >> 16) & 255);
      if (i + 2 < limpio.length) out.push((n >> 8) & 255);
      if (i + 3 < limpio.length) out.push(n & 255);
    }
    return Uint8Array.from(out);
  },
};

/** Una clave privada Ed25519 son 32 bytes aleatorios; el caller provee la fuente de aleatoriedad. */
export function clavePublicaDe(clavePrivada: Uint8Array): Uint8Array {
  return ed.getPublicKey(clavePrivada);
}

export function firmarBytes(mensaje: Uint8Array, clavePrivada: Uint8Array): Uint8Array {
  return ed.sign(mensaje, clavePrivada);
}

export function verificarBytes(firma: Uint8Array, mensaje: Uint8Array, clavePublica: Uint8Array): boolean {
  try {
    return ed.verify(firma, mensaje, clavePublica);
  } catch {
    return false; // firma o clave mal formadas
  }
}
