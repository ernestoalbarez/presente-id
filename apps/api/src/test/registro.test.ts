import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { base64url, clavePublicaDe } from '@presente/shared';
import { createApp } from '../app';
import { PASSWORD_DEMO, nroTramiteDe } from '../../prisma/seed';

const app = createApp();

/** Simula un teléfono nuevo: deviceId + par de claves Ed25519. */
function nuevoTelefono() {
  const priv = new Uint8Array(randomBytes(32));
  return { deviceId: randomUUID(), publicKey: base64url.encode(clavePublicaDe(priv)), modelo: 'test' };
}

const registrar = (dni: string, sexo: string, tel = nuevoTelefono(), nroTramite = nroTramiteDe(dni)) =>
  request(app).post('/registro').send({ dni, sexo, nroTramite, ...tel });

const yo = (token: string) => request(app).get('/yo').set('Authorization', `Bearer ${token}`);

async function tokenDirectora() {
  const res = await request(app).post('/auth/login').send({ email: 'directora@presente.edu.ar', password: PASSWORD_DEMO });
  return res.body.token as string;
}

describe('registro con mock RENAPER', () => {
  it('rechaza un DNI terminado en 0 sin entregar token', async () => {
    const res = await registrar('45234560', 'M');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'RECHAZADO' });
    expect(res.body.deviceToken).toBeUndefined();
  });

  it('rechaza si el número de trámite no coincide', async () => {
    const res = await registrar('45123453', 'F', nuevoTelefono(), '00000000000');
    expect(res.body.estado).toBe('RECHAZADO');
  });

  it('responde 404 NO_INSCRIPTO si existe en RENAPER pero no en la institución', async () => {
    const res = await registrar('38765435', 'M');
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_INSCRIPTO');
  });

  it('valida los datos de entrada', async () => {
    const res = await request(app).post('/registro').send({ dni: '12', sexo: 'M' });
    expect(res.status).toBe(400);
  });
});

describe('vinculación de dispositivo', () => {
  it('aprueba, vincula el teléfono y luego exige aprobación para cambiarlo', async () => {
    const telA = nuevoTelefono();
    const a = await registrar('44901231', 'F', telA);
    expect(a.body.estado).toBe('VALIDADO');
    expect((await yo(a.body.deviceToken)).body).toMatchObject({ situacion: 'ACTIVO', estadoValidacion: 'VALIDADO', dni: '44901231' });

    // Reintentar desde el mismo teléfono no genera una solicitud de cambio.
    expect((await registrar('44901231', 'F', telA)).body.estado).toBe('VALIDADO');

    // Segundo teléfono → queda pendiente y el primero sigue activo.
    const b = await registrar('44901231', 'F');
    expect(b.body.estado).toBe('CAMBIO_DISPOSITIVO_PENDIENTE');
    expect((await yo(b.body.deviceToken)).body.situacion).toBe('CAMBIO_PENDIENTE');
    expect((await yo(a.body.deviceToken)).body.situacion).toBe('ACTIVO');

    // El directivo aprueba → el nuevo pasa a ACTIVO y el viejo queda REVOCADO.
    const token = await tokenDirectora();
    const solicitudes = await request(app).get('/dispositivos/solicitudes').set('Authorization', `Bearer ${token}`);
    const solicitud = solicitudes.body.find((s: { estudiante: { dni: string } }) => s.estudiante.dni === '44901231');
    expect(solicitud).toBeDefined();
    const ok = await request(app).post(`/dispositivos/solicitudes/${solicitud.id}/aprobar`).set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);

    expect((await yo(b.body.deviceToken)).body.situacion).toBe('ACTIVO');
    expect((await yo(a.body.deviceToken)).body.situacion).toBe('REVOCADO');
  });

  it('no permite registrar un teléfono revocado ni reutilizar un deviceId con otra clave', async () => {
    const tel = nuevoTelefono();
    const r = await registrar('44012342', 'M', tel);
    expect(r.body.estado).toBe('VALIDADO');
    const otraClave = { ...nuevoTelefono(), deviceId: tel.deviceId };
    expect((await registrar('44012342', 'M', otraClave)).body.codigo).toBe('DISPOSITIVO_EN_USO');

    const token = await tokenDirectora();
    const activos = await request(app).get('/dispositivos').set('Authorization', `Bearer ${token}`);
    const d = activos.body.find((x: { estudiante: { dni: string } }) => x.estudiante.dni === '44012342');
    await request(app).post(`/dispositivos/${d.id}/revocar`).set('Authorization', `Bearer ${token}`).send({ motivo: 'test' });

    expect((await registrar('44012342', 'M', tel)).body.codigo).toBe('DISPOSITIVO_REVOCADO');
  });

  it('revisión manual: queda EN_REVISION hasta que un directivo aprueba', async () => {
    const r = await registrar('46456789', 'M');
    expect(r.body.estado).toBe('EN_REVISION');
    expect((await yo(r.body.deviceToken)).body.situacion).toBe('EN_REVISION');

    const token = await tokenDirectora();
    const lista = await request(app).get('/validaciones').set('Authorization', `Bearer ${token}`);
    const v = lista.body.find((x: { dni: string }) => x.dni === '46456789');
    expect(v.renaper.nombre).toBe('Thiago');
    await request(app).post(`/validaciones/${v.id}/aprobar`).set('Authorization', `Bearer ${token}`).expect(200);

    expect((await yo(r.body.deviceToken)).body).toMatchObject({ situacion: 'ACTIVO', estadoValidacion: 'VALIDADO' });
  });

  it('revisión manual rechazada: el teléfono queda RECHAZADO', async () => {
    const r = await registrar('46567899', 'F');
    const token = await tokenDirectora();
    const lista = await request(app).get('/validaciones').set('Authorization', `Bearer ${token}`);
    const v = lista.body.find((x: { dni: string }) => x.dni === '46567899');
    await request(app).post(`/validaciones/${v.id}/rechazar`).set('Authorization', `Bearer ${token}`).send({ motivo: 'Selfie borrosa' }).expect(200);
    expect((await yo(r.body.deviceToken)).body).toMatchObject({ situacion: 'RECHAZADO', motivo: 'Selfie borrosa' });
  });

  it('un docente no puede gestionar dispositivos', async () => {
    const login = await request(app).post('/auth/login').send({ email: 'docente1@presente.edu.ar', password: PASSWORD_DEMO });
    const res = await request(app).get('/dispositivos/solicitudes').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });
});
