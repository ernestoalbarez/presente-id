import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, login, telefonoValidado, type Auth } from './helpers';

const verificar = (auth: Auth, qr: string) => request(app).post('/verificaciones/identidad').set(auth).send({ qr });

describe('verificación de identidad por QR', () => {
  it('GET /yo incluye lo que la app necesita para firmar el QR', async () => {
    const { perfil } = await telefonoValidado('45123453', 'F');
    expect(perfil).toMatchObject({ usuarioId: expect.any(String), institucion: expect.any(String), ahoraServidor: expect.any(String) });
  });

  it('VALIDO con datos del estudiante; el mismo QR otra vez es INVALIDO; todo queda registrado', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const tel = await telefonoValidado('45123453', 'F');
    const qr = tel.qrIdentidad();

    const ok = await verificar(docente, qr);
    expect(ok.status).toBe(200);
    expect(ok.body.resultado).toBe('VALIDO');
    expect(ok.body.estudiante).toMatchObject({ dni: '45123453', nombre: 'Emma', estadoValidacion: 'VALIDADO' });
    expect(ok.body.estudiante.cursos).toContain('Programación II');

    const replay = await verificar(docente, qr);
    expect(replay.body.resultado).toBe('INVALIDO');

    const lista = await request(app).get('/verificaciones').set(docente);
    const ids = lista.body.map((v: { id: string }) => v.id);
    expect(ids).toEqual(expect.arrayContaining([ok.body.id, replay.body.id]));
  });

  it('DISPOSITIVO_REVOCADO después de que un directivo revoca el teléfono', async () => {
    const tel = await telefonoValidado('45123453', 'F');
    const directora = await login('directora@presente.edu.ar');
    const activo = (await request(app).get('/dispositivos').set(directora)).body.find(
      (d: { estudiante: { dni: string } }) => d.estudiante.dni === '45123453',
    );
    await request(app).post(`/dispositivos/${activo.id}/revocar`).set(directora).send({}).expect(200);

    const r = await verificar(await login('docente1@presente.edu.ar'), tel.qrIdentidad());
    expect(r.body.resultado).toBe('DISPOSITIVO_REVOCADO');
    expect(r.body.estudiante.dni).toBe('45123453');
  });

  it('INVALIDO sin datos del estudiante para texto arbitrario', async () => {
    const r = await verificar(await login('docente1@presente.edu.ar'), 'hola');
    expect(r.body).toMatchObject({ resultado: 'INVALIDO' });
    expect(r.body.estudiante).toBeUndefined();
  });

  it('exige sesión de staff', async () => {
    expect((await request(app).post('/verificaciones/identidad').send({ qr: 'x' })).status).toBe(401);
  });
});
