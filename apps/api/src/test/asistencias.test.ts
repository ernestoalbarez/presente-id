import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { SesionDetalle, SesionResumen } from '@presente/shared';
import { app, login, telefonoValidado, type Auth } from './helpers';

/** Sesión de hoy del curso indicado (el seed crea una de Programación II y un examen de BD). */
async function sesionDeHoy(auth: Auth, curso: string, tipo: 'CLASE' | 'EXAMEN') {
  const r = await request(app).get('/sesiones').set(auth);
  const s = (r.body as SesionResumen[]).find((x) => x.curso === curso && x.tipo === tipo && new Date(x.fin) > new Date());
  expect(s).toBeDefined();
  return s!;
}

const qrDe = async (auth: Auth, sesionId: string) => (await request(app).get(`/sesiones/${sesionId}/qr`).set(auth)).body.qr as string;

describe('sesiones y acceso', () => {
  it('el docente ve solo las sesiones de sus cursos', async () => {
    const d1 = (await request(app).get('/sesiones').set(await login('docente1@presente.edu.ar'))).body as SesionResumen[];
    const d2 = (await request(app).get('/sesiones').set(await login('docente2@presente.edu.ar'))).body as SesionResumen[];
    expect(d1.map((s) => s.curso)).toEqual(expect.arrayContaining(['Programación II', 'Bases de Datos']));
    expect(d1.some((s) => s.curso === 'Redes y Comunicaciones')).toBe(false);
    expect(d2.every((s) => s.curso === 'Redes y Comunicaciones')).toBe(true);

    const ajena = d1[0];
    expect((await request(app).get(`/sesiones/${ajena.id}`).set(await login('docente2@presente.edu.ar'))).status).toBe(404);
  });

  it('crea una sesión validando las fechas; los exámenes exigen verificación por defecto', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const curso = (await request(app).get('/cursos').set(docente)).body.find((c: { codigo: string }) => c.codigo === 'BD');
    const inicio = new Date(Date.now() + 86_400_000);
    const fin = new Date(inicio.getTime() + 2 * 3_600_000);

    const mal = await request(app).post(`/cursos/${curso.id}/sesiones`).set(docente).send({ tipo: 'CLASE', inicio: fin, fin: inicio, aula: 'Lab' });
    expect(mal.status).toBe(400);

    const ok = await request(app).post(`/cursos/${curso.id}/sesiones`).set(docente).send({ tipo: 'EXAMEN', inicio, fin, aula: 'Lab 3' });
    expect(ok.status).toBe(201);
    const det = (await request(app).get(`/sesiones/${ok.body.id}`).set(docente)).body as SesionDetalle;
    expect(det).toMatchObject({ tipo: 'EXAMEN', requiereVerificacionIdentidad: true, estado: 'PROGRAMADA' });
  });
});

describe('presente por QR', () => {
  it('flujo completo: abrir, escanear, duplicado, replay y cierre', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const sesion = await sesionDeHoy(docente, 'Programación II', 'CLASE');
    // Otras suites pueden haberla abierto antes: la cerramos y el QR se niega.
    await request(app).post(`/sesiones/${sesion.id}/cerrar`).set(docente).expect(200);
    expect((await request(app).get(`/sesiones/${sesion.id}/qr`).set(docente)).status).toBe(409);

    await request(app).post(`/sesiones/${sesion.id}/abrir`).set(docente).expect(200);
    const qr = await qrDe(docente, sesion.id);
    const tel = await telefonoValidado('42567895', 'F');

    const jws = tel.firmarEscaneo(qr);
    const ok = await tel.escanearAsistencia(qr, jws);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ curso: 'Programación II', tipo: 'CLASE' });

    expect((await tel.escanearAsistencia(qr, jws)).body.codigo).toBe('ESCANEO_REPETIDO'); // mismo JWS reenviado
    expect((await tel.escanearAsistencia(qr)).body.codigo).toBe('YA_PRESENTE'); // nuevo escaneo, misma sesión

    const det = (await request(app).get(`/sesiones/${sesion.id}`).set(docente)).body as SesionDetalle;
    const fila = det.asistencias.find((a) => a.nombre === 'Valentina' && a.apellido === 'Martínez');
    expect(fila?.asistencia?.metodo).toBe('QR');

    await request(app).post(`/sesiones/${sesion.id}/cerrar`).set(docente).expect(200);
    const otro = await telefonoValidado('42678906', 'M');
    expect((await otro.escanearAsistencia(qr)).body.codigo).toBe('SESION_CERRADA');
    await request(app).post(`/sesiones/${sesion.id}/abrir`).set(docente).expect(200); // la dejamos abierta para otros tests
  });

  it('rechaza un escaneo firmado por otra clave y un QR que no es de asistencia', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const sesion = await sesionDeHoy(docente, 'Programación II', 'CLASE');
    await request(app).post(`/sesiones/${sesion.id}/abrir`).set(docente).expect(200);
    const qr = await qrDe(docente, sesion.id);
    const tel = await telefonoValidado('40234562', 'M');

    const ajeno = tel.firmarEscaneo(qr, new Uint8Array(32).fill(9));
    expect((await tel.escanearAsistencia(qr, ajeno)).body.codigo).toBe('ESCANEO_INVALIDO');
    expect((await tel.escanearAsistencia(tel.qrIdentidad())).body.codigo).toBe('QR_INVALIDO');
  });

  it('rechaza si el estudiante no está inscripto en el curso', async () => {
    const docente2 = await login('docente2@presente.edu.ar');
    const redes = (await request(app).get('/cursos').set(docente2)).body.find((c: { codigo: string }) => c.codigo === 'REDES');
    const nueva = await request(app)
      .post(`/cursos/${redes.id}/sesiones`)
      .set(docente2)
      .send({ tipo: 'CLASE', inicio: new Date(Date.now() - 5 * 60_000), fin: new Date(Date.now() + 3_600_000), aula: 'Aula 4' });
    await request(app).post(`/sesiones/${nueva.body.id}/abrir`).set(docente2).expect(200);
    const qr = await qrDe(docente2, nueva.body.id);

    const tel = await telefonoValidado('40123451', 'F'); // Camila: no cursa Redes
    const r = await tel.escanearAsistencia(qr);
    expect(r.status).toBe(403);
    expect(r.body.codigo).toBe('NO_INSCRIPTO_CURSO');
  });

  it('examen: la verificación de identidad marca el presente como verificado en persona', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const examen = await sesionDeHoy(docente, 'Bases de Datos', 'EXAMEN');
    await request(app).post(`/sesiones/${examen.id}/abrir`).set(docente).expect(200);

    const conPresente = await telefonoValidado('41345673', 'F'); // Lucía
    await conPresente.escanearAsistencia(await qrDe(docente, examen.id)).expect(201);
    const v = await request(app).post('/verificaciones/identidad').set(docente).send({ qr: conPresente.qrIdentidad(), sesionId: examen.id });
    expect(v.body).toMatchObject({ resultado: 'VALIDO', efectoEnSesion: 'VERIFICADA' });

    const sinPresente = await telefonoValidado('41456784', 'M'); // Mateo
    const v2 = await request(app).post('/verificaciones/identidad').set(docente).send({ qr: sinPresente.qrIdentidad(), sesionId: examen.id });
    expect(v2.body.efectoEnSesion).toBe('SIN_PRESENTE');

    const det = (await request(app).get(`/sesiones/${examen.id}`).set(docente)).body as SesionDetalle;
    expect(det.asistencias.find((a) => a.nombre === 'Lucía')?.asistencia?.verificadaPresencialmente).toBe(true);
  });

  it('corrección manual: exige motivo y queda auditada', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const sesion = await sesionDeHoy(docente, 'Programación II', 'CLASE');
    const det = (await request(app).get(`/sesiones/${sesion.id}`).set(docente)).body as SesionDetalle;
    const alumno = det.asistencias.find((a) => !a.asistencia)!;
    const url = `/sesiones/${sesion.id}/asistencias/${alumno.estudianteId}`;

    expect((await request(app).put(url).set(docente).send({ presente: true })).status).toBe(400);
    const r = await request(app).put(url).set(docente).send({ presente: true, motivo: 'Se olvidó el celular' });
    expect((r.body as SesionDetalle).asistencias.find((a) => a.estudianteId === alumno.estudianteId)?.asistencia?.metodo).toBe('MANUAL');

    const anulado = await request(app).put(url).set(docente).send({ presente: false, motivo: 'Marcado por error' });
    expect((anulado.body as SesionDetalle).asistencias.find((a) => a.estudianteId === alumno.estudianteId)?.asistencia).toBeNull();
  });
});
