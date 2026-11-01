import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { EntradaAuditoria } from '@presente/shared';
import { clock } from '../lib/clock';
import { app, login, telefonoValidado, type Auth } from './helpers';

const verificar = (auth: Auth, qr: string) => request(app).post('/verificaciones/identidad').set(auth).send({ qr });

afterAll(() => clock.setOffsetMs(0));

describe('modo demo', () => {
  it('adelantar el reloj vence el QR de identidad; volverlo a 0 lo revalida', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const tel = await telefonoValidado('45123453', 'F');
    const qr = tel.qrIdentidad();

    const adelantado = await request(app).post('/demo/reloj').set(docente).send({ offsetMin: 2 });
    expect(adelantado.body.offsetMin).toBe(2);
    expect((await request(app).get('/health')).body.offsetMin).toBe(2);
    expect((await verificar(docente, qr)).body.resultado).toBe('VENCIDO');

    await request(app).post('/demo/reloj').set(docente).send({ offsetMin: 0 }).expect(200);
    expect((await verificar(docente, qr)).body.resultado).toBe('VALIDO'); // VENCIDO no consume el nonce
  });

  it('la app también puede mover el reloj (con su token de dispositivo)', async () => {
    const tel = await telefonoValidado('45123453', 'F');
    const r = await tel.post('/demo/reloj', { offsetMin: 5 });
    expect(r.body.offsetMin).toBe(5);
    await tel.post('/demo/reloj', { offsetMin: 0 });
    expect((await request(app).post('/demo/reloj').send({ offsetMin: 1 })).status).toBe(401);
  });

  it('forzar sesión vencida hace que el presente falle por horario', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const curso = (await request(app).get('/cursos').set(docente)).body.find((c: { codigo: string }) => c.codigo === 'PROG2');
    const s = await request(app)
      .post(`/cursos/${curso.id}/sesiones`)
      .set(docente)
      .send({ tipo: 'CLASE', inicio: new Date(Date.now() - 600_000), fin: new Date(Date.now() + 3_600_000), aula: 'Demo' });
    await request(app).post(`/sesiones/${s.body.id}/abrir`).set(docente).expect(200);
    const qr = (await request(app).get(`/sesiones/${s.body.id}/qr`).set(docente)).body.qr;

    await request(app).post(`/demo/sesiones/${s.body.id}/vencer`).set(docente).expect(200);
    const tel = await telefonoValidado('45123453', 'F');
    const r = await tel.escanearAsistencia(qr);
    expect(r.body).toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
  });

  it('la app puede revocar su propio teléfono: su QR pasa a DISPOSITIVO_REVOCADO', async () => {
    const tel = await telefonoValidado('45123453', 'F');
    await tel.post('/demo/mi-dispositivo/revocar', {}).expect(200);
    expect((await tel.get('/yo')).body.situacion).toBe('REVOCADO');
    expect((await verificar(await login('docente1@presente.edu.ar'), tel.qrIdentidad())).body.resultado).toBe('DISPOSITIVO_REVOCADO');
  });
});

describe('auditoría', () => {
  it('une verificaciones, correcciones y cambios de dispositivo; filtra por categoría', async () => {
    const directora = await login('directora@presente.edu.ar');
    const todo = (await request(app).get('/auditoria').set(directora)).body as EntradaAuditoria[];
    const categorias = new Set(todo.map((e) => e.categoria));
    expect(categorias).toContain('VERIFICACIONES');
    expect(categorias).toContain('DISPOSITIVOS');
    expect(categorias).toContain('DEMO');
    expect(todo.find((e) => e.accion === 'DEMO_RELOJ')?.resumen).toMatch(/reloj \+?\d+ min/);

    const verif = (await request(app).get('/auditoria?categoria=VERIFICACIONES').set(directora)).body as EntradaAuditoria[];
    expect(verif.length).toBeGreaterThan(0);
    expect(verif.every((e) => e.categoria === 'VERIFICACIONES')).toBe(true);
  });

  it('solo directivos', async () => {
    expect((await request(app).get('/auditoria').set(await login('docente1@presente.edu.ar'))).status).toBe(403);
  });
});
