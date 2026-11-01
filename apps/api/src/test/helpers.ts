// Helpers de tests de integración: simulan lo que hacen la app (teléfono) y el backoffice.
// Ojo: todos los archivos comparten la misma base (seed cargado una vez). registro.test.ts
// espera que 44901231 y 44012342 lleguen sin teléfono: no usarlos en otras suites.
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import { base64url, clavePublicaDe, firmarEscaneo, generarQrIdentidad } from '@presente/shared';
import { createApp } from '../app';
import { PASSWORD_DEMO, nroTramiteDe } from '../../prisma/seed';

export const app = createApp();

export type Auth = Record<string, string>;

export async function login(email: string): Promise<Auth> {
  const r = await request(app).post('/auth/login').send({ email, password: PASSWORD_DEMO });
  expect(r.status).toBe(200);
  return { Authorization: `Bearer ${r.body.token}` };
}

const nonce = () => base64url.encode(new Uint8Array(randomBytes(16)));

/**
 * Registra un teléfono nuevo para el DNI y lo deja ACTIVO: si queda en revisión o con cambio
 * de dispositivo pendiente, la directora lo aprueba (como haría en el backoffice).
 */
export async function telefonoValidado(dni: string, sexo: 'M' | 'F') {
  const clavePrivada = new Uint8Array(randomBytes(32));
  const deviceId = randomUUID();
  const reg = await request(app)
    .post('/registro')
    .send({ dni, sexo, nroTramite: nroTramiteDe(dni), deviceId, publicKey: base64url.encode(clavePublicaDe(clavePrivada)) });
  expect(reg.body.deviceToken).toBeDefined();
  const dev = { Authorization: `Bearer ${reg.body.deviceToken}` };
  const directora = await login('directora@presente.edu.ar');

  if ((await request(app).get('/yo').set(dev)).body.situacion === 'EN_REVISION') {
    const v = (await request(app).get('/validaciones').set(directora)).body.find((x: { dni: string }) => x.dni === dni);
    await request(app).post(`/validaciones/${v.id}/aprobar`).set(directora).send({}).expect(200);
  }
  if ((await request(app).get('/yo').set(dev)).body.situacion === 'CAMBIO_PENDIENTE') {
    const s = (await request(app).get('/dispositivos/solicitudes').set(directora)).body.find(
      (x: { estudiante: { dni: string } }) => x.estudiante.dni === dni,
    );
    await request(app).post(`/dispositivos/solicitudes/${s.id}/aprobar`).set(directora).expect(200);
  }
  const perfil = (await request(app).get('/yo').set(dev)).body;
  expect(perfil.situacion).toBe('ACTIVO');

  const ahoraSeg = () => Math.floor(Date.now() / 1000);
  const firmar = (qr: string, clave = clavePrivada) => firmarEscaneo({ qr, deviceId, ahoraSeg: ahoraSeg(), nonce: nonce(), clavePrivada: clave });
  return {
    perfil,
    deviceId,
    /** QR de identidad tal como lo genera la app. */
    qrIdentidad: () => generarQrIdentidad({ usuarioId: perfil.usuarioId, deviceId, ahoraSeg: ahoraSeg(), nonce: nonce(), clavePrivada }).qr,
    /** JWS de escaneo firmado (opcionalmente con otra clave, para simular un teléfono ajeno). */
    firmarEscaneo: firmar,
    /** Escanea un QR de asistencia como lo hace la app. */
    escanearAsistencia: (qr: string, jws = firmar(qr)) => request(app).post('/asistencias/escaneo').set(dev).send({ jws }),
  };
}
