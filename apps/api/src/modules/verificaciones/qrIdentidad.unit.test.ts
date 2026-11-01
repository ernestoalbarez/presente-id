import { describe, expect, it } from 'vitest';
import { base64url, clavePublicaDe, firmarJws, generarQrIdentidad } from '@presente/shared';
import { verificarQrIdentidad, type DepsVerificacion, type DispositivoParaVerificar } from './qrIdentidad';

const priv = Uint8Array.from({ length: 32 }, (_, i) => i * 3);
const AHORA = 1_800_000_000;
const NONCE = 'nonce-de-prueba-123';

const dispositivo = (estado = 'ACTIVO'): DispositivoParaVerificar => ({
  id: 'd1',
  usuarioId: 'u1',
  publicKey: base64url.encode(clavePublicaDe(priv)),
  estado,
});

/** Dependencias en memoria: un dispositivo y un set de nonces usados. */
function deps(over: Partial<DepsVerificacion> & { estado?: string } = {}): DepsVerificacion {
  const usados = new Set<string>();
  return {
    ahoraSeg: AHORA,
    buscarDispositivo: async (did) => (did === 'dev-1' ? dispositivo(over.estado) : null),
    consumirNonce: async (n) => !usados.has(n) && !!usados.add(n),
    ...over,
  };
}

const qr = (over: { ahoraSeg?: number; deviceId?: string; usuarioId?: string; clave?: Uint8Array } = {}) =>
  generarQrIdentidad({
    usuarioId: over.usuarioId ?? 'u1',
    deviceId: over.deviceId ?? 'dev-1',
    ahoraSeg: over.ahoraSeg ?? AHORA,
    nonce: NONCE,
    clavePrivada: over.clave ?? priv,
  }).qr;

describe('verificarQrIdentidad', () => {
  it('VALIDO con un QR recién generado', async () => {
    const r = await verificarQrIdentidad(qr(), deps());
    expect(r.resultado).toBe('VALIDO');
    expect(r.dispositivo?.usuarioId).toBe('u1');
  });

  it('VENCIDO pasados 30 s + tolerancia (captura de pantalla vieja)', async () => {
    expect((await verificarQrIdentidad(qr({ ahoraSeg: AHORA - 34 }), deps())).resultado).toBe('VALIDO');
    const r = await verificarQrIdentidad(qr({ ahoraSeg: AHORA - 36 }), deps());
    expect(r.resultado).toBe('VENCIDO');
    expect(r.dispositivo).toBeDefined(); // la firma es auténtica: se sabe de quién es
  });

  it('INVALIDO si el mismo QR se escanea dos veces (replay)', async () => {
    const d = deps();
    const codigo = qr();
    expect((await verificarQrIdentidad(codigo, d)).resultado).toBe('VALIDO');
    const r = await verificarQrIdentidad(codigo, d);
    expect(r.resultado).toBe('INVALIDO');
    expect(r.motivo).toMatch(/ya fue escaneado/);
  });

  it('DISPOSITIVO_REVOCADO si el teléfono fue dado de baja', async () => {
    expect((await verificarQrIdentidad(qr(), deps({ estado: 'REVOCADO' }))).resultado).toBe('DISPOSITIVO_REVOCADO');
  });

  it('INVALIDO si lo firmó otra clave (QR falsificado)', async () => {
    const r = await verificarQrIdentidad(qr({ clave: priv.map((b) => b ^ 7) }), deps());
    expect(r).toMatchObject({ resultado: 'INVALIDO', motivo: 'La firma del QR no es válida' });
    expect(r.dispositivo).toBeUndefined();
  });

  it('INVALIDO si el usuario no es el dueño del dispositivo o el dispositivo no existe', async () => {
    expect((await verificarQrIdentidad(qr({ usuarioId: 'otro' }), deps())).resultado).toBe('INVALIDO');
    expect((await verificarQrIdentidad(qr({ deviceId: 'dev-x' }), deps())).resultado).toBe('INVALIDO');
  });

  it('INVALIDO si el teléfono se autoemite un QR de larga vida o con fecha futura', async () => {
    const eterno = firmarJws('presente-id+jws', { sub: 'u1', did: 'dev-1', iat: AHORA, exp: AHORA + 3600, nonce: NONCE }, priv);
    expect((await verificarQrIdentidad(eterno, deps())).motivo).toMatch(/vigencia inválida/);
    expect((await verificarQrIdentidad(qr({ ahoraSeg: AHORA + 60 }), deps())).motivo).toMatch(/vigencia inválida/);
  });

  it('INVALIDO con texto que no es un QR de PresenteID u otro typ', async () => {
    expect((await verificarQrIdentidad('https://example.com', deps())).resultado).toBe('INVALIDO');
    const otroTyp = firmarJws('otra-cosa', { sub: 'u1', did: 'dev-1', iat: AHORA, exp: AHORA + 30, nonce: NONCE }, priv);
    expect((await verificarQrIdentidad(otroTyp, deps())).resultado).toBe('INVALIDO');
  });
});
