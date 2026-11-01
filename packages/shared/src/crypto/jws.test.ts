import { jwtVerify, importJWK } from 'jose';
import { describe, expect, it } from 'vitest';
import { base64url, clavePublicaDe } from './ed25519';
import { decodificarJws, firmarJws } from './jws';

const priv = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const pub = clavePublicaDe(priv);

describe('JWS EdDSA', () => {
  it('firma y verifica; decodifica header y payload', () => {
    const t = firmarJws('prueba', { a: 1, txt: 'ñandú' }, priv);
    const d = decodificarJws<{ a: number; txt: string }>(t)!;
    expect(d.header).toEqual({ alg: 'EdDSA', typ: 'prueba' });
    expect(d.payload).toEqual({ a: 1, txt: 'ñandú' });
    expect(d.verificar(pub)).toBe(true);
  });

  it('detecta un payload alterado', () => {
    const [h, , f] = firmarJws('prueba', { a: 1 }, priv).split('.');
    const otro = base64url.encode(new TextEncoder().encode(JSON.stringify({ a: 2 })));
    expect(decodificarJws(`${h}.${otro}.${f}`)!.verificar(pub)).toBe(false);
  });

  it('rechaza otra clave y tokens mal formados', () => {
    const t = firmarJws('prueba', { a: 1 }, priv);
    expect(decodificarJws(t)!.verificar(clavePublicaDe(priv.map((b) => b ^ 1)))).toBe(false);
    expect(decodificarJws('no-es-un-jws')).toBeNull();
    expect(decodificarJws('a.b.c')).toBeNull();
  });

  it('es un JWS estándar: jose lo verifica', async () => {
    const t = firmarJws('prueba', { sub: 'x', exp: 4102444800 }, priv);
    const key = await importJWK({ kty: 'OKP', crv: 'Ed25519', x: base64url.encode(pub) }, 'EdDSA');
    const { payload } = await jwtVerify(t, key);
    expect(payload.sub).toBe('x');
  });
});
