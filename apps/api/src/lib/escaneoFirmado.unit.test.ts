import { describe, expect, it } from 'vitest';
import { base64url, clavePublicaDe, firmarEscaneo, firmarJws } from '@presente/shared';
import { verificarEscaneoFirmado } from './escaneoFirmado';

const priv = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);
const disp = { deviceId: 'dev-1', publicKey: base64url.encode(clavePublicaDe(priv)) };
const AHORA = 1_800_000_000;
const escaneo = (over: Partial<{ deviceId: string; ahoraSeg: number; clave: Uint8Array }> = {}) =>
  firmarEscaneo({ qr: 'token-del-aula', deviceId: over.deviceId ?? 'dev-1', ahoraSeg: over.ahoraSeg ?? AHORA, nonce: 'n'.repeat(22), clavePrivada: over.clave ?? priv });

describe('verificarEscaneoFirmado', () => {
  it('acepta un escaneo firmado por el dispositivo y devuelve el QR escaneado', () => {
    const r = verificarEscaneoFirmado(escaneo(), disp, AHORA + 3);
    expect(r).toMatchObject({ ok: true, payload: { qr: 'token-del-aula', did: 'dev-1' } });
  });
  it('rechaza la firma de otro teléfono (alguien copió el token del aula)', () => {
    expect(verificarEscaneoFirmado(escaneo({ clave: priv.map((b) => b ^ 1) }), disp, AHORA)).toMatchObject({ ok: false });
  });
  it('rechaza si el deviceId del payload no es el de la sesión', () => {
    expect(verificarEscaneoFirmado(escaneo({ deviceId: 'dev-2' }), disp, AHORA)).toMatchObject({ ok: false });
  });
  it('rechaza escaneos viejos o del futuro (más de 30 s)', () => {
    expect(verificarEscaneoFirmado(escaneo({ ahoraSeg: AHORA - 31 }), disp, AHORA).ok).toBe(false);
    expect(verificarEscaneoFirmado(escaneo({ ahoraSeg: AHORA + 31 }), disp, AHORA).ok).toBe(false);
  });
  it('rechaza otros JWS del teléfono (p. ej. su QR de identidad)', () => {
    const otro = firmarJws('presente-id+jws', { qr: 'x', did: 'dev-1', ts: AHORA, nonce: 'n'.repeat(22) }, priv);
    expect(verificarEscaneoFirmado(otro, disp, AHORA).ok).toBe(false);
  });
});
