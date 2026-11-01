import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { base64url, clavePublicaDe, generarQrIdentidad } from '@presente/shared';
import { createApp } from '../app';
import { PASSWORD_DEMO, nroTramiteDe } from '../../prisma/seed';

const app = createApp();

async function loginDirectora() {
  const r = await request(app).post('/auth/login').send({ email: 'directora@presente.edu.ar', password: PASSWORD_DEMO });
  return { Authorization: `Bearer ${r.body.token}` };
}

async function loginDocente() {
  const r = await request(app).post('/auth/login').send({ email: 'docente1@presente.edu.ar', password: PASSWORD_DEMO });
  return r.body.token as string;
}

/** Registra un teléfono para el DNI y devuelve lo necesario para generar QRs como lo haría la app. */
async function telefonoValidado(dni: string, sexo: string) {
  const clavePrivada = new Uint8Array(randomBytes(32));
  const deviceId = randomUUID();
  const reg = await request(app)
    .post('/registro')
    .send({ dni, sexo, nroTramite: nroTramiteDe(dni), deviceId, publicKey: base64url.encode(clavePublicaDe(clavePrivada)) });
  if (reg.body.estado === 'CAMBIO_DISPOSITIVO_PENDIENTE') {
    // Ya tenía otro teléfono: la directora aprueba el cambio.
    const auth = await loginDirectora();
    const sol = (await request(app).get('/dispositivos/solicitudes').set(auth)).body.find(
      (x: { estudiante: { dni: string } }) => x.estudiante.dni === dni,
    );
    await request(app).post(`/dispositivos/solicitudes/${sol.id}/aprobar`).set(auth).expect(200);
  } else {
    expect(reg.body.estado).toBe('VALIDADO');
  }
  const yo = await request(app).get('/yo').set('Authorization', `Bearer ${reg.body.deviceToken}`);
  const generar = () =>
    generarQrIdentidad({
      usuarioId: yo.body.usuarioId,
      deviceId,
      ahoraSeg: Math.floor(Date.parse(yo.body.ahoraServidor) / 1000),
      nonce: base64url.encode(new Uint8Array(randomBytes(16))),
      clavePrivada,
    }).qr;
  return { generar, perfil: yo.body };
}

const verificar = (token: string, qr: string) =>
  request(app).post('/verificaciones/identidad').set('Authorization', `Bearer ${token}`).send({ qr });

describe('verificación de identidad por QR', () => {
  it('GET /yo incluye lo que la app necesita para firmar el QR', async () => {
    const { perfil } = await telefonoValidado('45123453', 'F');
    expect(perfil).toMatchObject({ usuarioId: expect.any(String), institucion: expect.any(String), ahoraServidor: expect.any(String) });
  });

  it('VALIDO con datos del estudiante; el mismo QR otra vez es INVALIDO; todo queda registrado', async () => {
    const token = await loginDocente();
    const { generar } = await telefonoValidado('45123453', 'F');
    const qr = generar();

    const ok = await verificar(token, qr);
    expect(ok.status).toBe(200);
    expect(ok.body.resultado).toBe('VALIDO');
    expect(ok.body.estudiante).toMatchObject({ dni: '45123453', nombre: 'Emma', estadoValidacion: 'VALIDADO' });
    expect(ok.body.estudiante.cursos).toContain('Programación II');

    const replay = await verificar(token, qr);
    expect(replay.body.resultado).toBe('INVALIDO');

    const lista = await request(app).get('/verificaciones').set('Authorization', `Bearer ${token}`);
    const ids = lista.body.map((v: { id: string }) => v.id);
    expect(ids).toEqual(expect.arrayContaining([ok.body.id, replay.body.id]));
  });

  it('DISPOSITIVO_REVOCADO después de que un directivo revoca el teléfono', async () => {
    const { generar } = await telefonoValidado('45123453', 'F');
    const auth = await loginDirectora();
    const activo = (await request(app).get('/dispositivos').set(auth)).body.find(
      (d: { estudiante: { dni: string } }) => d.estudiante.dni === '45123453',
    );
    await request(app).post(`/dispositivos/${activo.id}/revocar`).set(auth).send({}).expect(200);

    const r = await verificar(await loginDocente(), generar());
    expect(r.body.resultado).toBe('DISPOSITIVO_REVOCADO');
    expect(r.body.estudiante.dni).toBe('45123453');
  });

  it('INVALIDO sin datos del estudiante para texto arbitrario', async () => {
    const r = await verificar(await loginDocente(), 'hola');
    expect(r.body).toMatchObject({ resultado: 'INVALIDO' });
    expect(r.body.estudiante).toBeUndefined();
  });

  it('exige sesión de staff', async () => {
    expect((await request(app).post('/verificaciones/identidad').send({ qr: 'x' })).status).toBe(401);
  });
});
