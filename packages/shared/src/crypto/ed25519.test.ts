import { describe, expect, it } from 'vitest';
import { base64url, clavePublicaDe, firmarBytes, verificarBytes } from './ed25519';

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);

describe('base64url', () => {
  it('ida y vuelta para todos los largos (padding implícito)', () => {
    for (let n = 0; n < 40; n++) expect(base64url.decode(base64url.encode(bytes(n)))).toEqual(bytes(n));
  });
  it('coincide con la codificación de Node', () => {
    const b = bytes(32);
    expect(base64url.encode(b)).toBe(Buffer.from(b).toString('base64url'));
  });
  it('rechaza caracteres fuera del alfabeto', () => {
    expect(() => base64url.decode('ab+/')).toThrow();
  });
});

describe('Ed25519', () => {
  const priv = bytes(32);
  const pub = clavePublicaDe(priv);
  const msg = new TextEncoder().encode('hola');

  it('la clave pública tiene 32 bytes (43 caracteres base64url)', () => {
    expect(pub).toHaveLength(32);
    expect(base64url.encode(pub)).toHaveLength(43);
  });
  it('verifica una firma válida y rechaza mensaje o clave alterados', () => {
    const firma = firmarBytes(msg, priv);
    expect(verificarBytes(firma, msg, pub)).toBe(true);
    expect(verificarBytes(firma, new TextEncoder().encode('chau'), pub)).toBe(false);
    const otraClave = clavePublicaDe(priv.map((b) => b ^ 1));
    expect(verificarBytes(firma, msg, otraClave)).toBe(false);
  });
  it('no lanza con firmas mal formadas', () => {
    expect(verificarBytes(new Uint8Array(3), msg, pub)).toBe(false);
  });
});
