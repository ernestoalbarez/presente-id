// JWS compacto (RFC 7515) firmado con Ed25519 ("alg": "EdDSA"), implementado sobre noble para
// que funcione igual en el teléfono (Expo Go) y en el servidor. Es el formato estándar: un
// token firmado acá también se puede verificar con `jose` u otra librería JWT.
import { base64url, firmarBytes, verificarBytes } from './ed25519';

const utf8 = (s: string) => new TextEncoder().encode(s);

export interface JwsDecodificado<P> {
  header: { alg: string; typ?: string };
  payload: P;
  /** Verifica la firma con una clave pública Ed25519 (32 bytes). */
  verificar(clavePublica: Uint8Array): boolean;
}

export function firmarJws(typ: string, payload: object, clavePrivada: Uint8Array): string {
  const h = base64url.encode(utf8(JSON.stringify({ alg: 'EdDSA', typ })));
  const p = base64url.encode(utf8(JSON.stringify(payload)));
  const firma = firmarBytes(utf8(`${h}.${p}`), clavePrivada);
  return `${h}.${p}.${base64url.encode(firma)}`;
}

/** Decodifica sin verificar. Devuelve null si el token está mal formado. */
export function decodificarJws<P>(token: string): JwsDecodificado<P> | null {
  const partes = token.trim().split('.');
  if (partes.length !== 3) return null;
  const [h, p, f] = partes;
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(base64url.decode(h)));
    const payload = JSON.parse(dec.decode(base64url.decode(p)));
    const firma = base64url.decode(f);
    if (typeof header !== 'object' || typeof payload !== 'object' || header === null || payload === null) return null;
    return {
      header,
      payload,
      verificar: (clavePublica) => header.alg === 'EdDSA' && verificarBytes(firma, utf8(`${h}.${p}`), clavePublica),
    };
  } catch {
    return null;
  }
}
