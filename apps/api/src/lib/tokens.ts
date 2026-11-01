// Tokens firmados por el servidor (JWS compacto, EdDSA/Ed25519, con `jose`).
// La misma clave firma tokens de sesión del backoffice y, en etapas siguientes, los QR de
// asistencia, de puerta y las constancias. El header `typ` distingue el uso de cada token
// para que uno no pueda presentarse en lugar de otro.
import { SignJWT, jwtVerify, importJWK, type JWTPayload, type CryptoKey } from 'jose';
import { TYP_QR_ASISTENCIA, TYP_QR_PUERTA } from '@presente/shared';
import { config } from '../config';
import { clock } from './clock';

// staff: sesión del backoffice · dispositivo: sesión del teléfono vinculado de un estudiante ·
// TYP_QR_ASISTENCIA / TYP_QR_PUERTA: contenido de los QR que genera el servidor.
export type TipoToken = 'staff' | 'dispositivo' | typeof TYP_QR_ASISTENCIA | typeof TYP_QR_PUERTA;

let claves: Promise<{ privada: CryptoKey; publica: CryptoKey }> | undefined;

function getClaves() {
  claves ??= (async () => {
    const { d, x } = config.serverKey;
    const privada = (await importJWK({ kty: 'OKP', crv: 'Ed25519', d, x }, 'EdDSA')) as CryptoKey;
    const publica = (await importJWK({ kty: 'OKP', crv: 'Ed25519', x }, 'EdDSA')) as CryptoKey;
    return { privada, publica };
  })();
  return claves;
}

export async function firmarToken(typ: TipoToken, claims: JWTPayload, ttlSegundos: number): Promise<string> {
  const ahora = clock.nowSeconds();
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', typ })
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + ttlSegundos)
    .sign((await getClaves()).privada);
}

/** Verifica firma, tipo y vigencia (según el reloj del servidor). Lanza si algo falla. */
export async function verificarToken<T extends JWTPayload>(typ: TipoToken, token: string): Promise<T> {
  const { payload } = await jwtVerify<T>(token, (await getClaves()).publica, {
    typ,
    algorithms: ['EdDSA'],
    currentDate: clock.now(),
  });
  return payload;
}
