import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ReporteIngresos, SedeConPuntos } from '@presente/shared';
import { app, login, sesionAbiertaDeHoy, telefonoValidado } from './helpers';

describe('ingreso a sede', () => {
  it('solo directivos gestionan puertas', async () => {
    expect((await request(app).get('/sedes').set(await login('docente1@presente.edu.ar'))).status).toBe(403);
    const sedes = (await request(app).get('/sedes').set(await login('directora@presente.edu.ar'))).body as SedeConPuntos[];
    expect(sedes).toHaveLength(2);
    expect(sedes.flatMap((s) => s.puntos)).toHaveLength(3);
  });

  it('alterna INGRESO/EGRESO, evita dobles escaneos y aparece en el reporte', async () => {
    const directora = await login('directora@presente.edu.ar');
    const sedes = (await request(app).get('/sedes').set(directora)).body as SedeConPuntos[];
    const centro = sedes.find((s) => s.nombre === 'Sede Centro')!;
    const principal = centro.puntos.find((p) => p.modo === 'ESTATICO')!;
    const biblioteca = centro.puntos.find((p) => p.modo === 'ROTATIVO')!;

    const qrPrincipal = (await request(app).get(`/puntos-acceso/${principal.id}/qr`).set(directora)).body;
    expect(qrPrincipal).toMatchObject({ modo: 'ESTATICO', sede: 'Sede Centro' });
    expect(qrPrincipal.rotaEnSeg).toBeUndefined();
    const qrBiblio = (await request(app).get(`/puntos-acceso/${biblioteca.id}/qr`).set(directora)).body;
    expect(qrBiblio.rotaEnSeg).toBe(15);

    const tel = await telefonoValidado('43890128', 'M'); // Santiago Romero
    const ingreso = await tel.escanearPuerta(qrPrincipal.qr);
    expect(ingreso.status).toBe(201);
    expect(ingreso.body).toMatchObject({ tipo: 'INGRESO', sede: 'Sede Centro', punto: 'Puerta principal' });

    expect((await tel.escanearPuerta(qrPrincipal.qr)).body.codigo).toBe('INGRESO_REPETIDO');
    expect((await tel.escanearPuerta(qrBiblio.qr)).body.tipo).toBe('EGRESO'); // otra puerta: alterna

    const reporte = (await request(app).get('/reportes/ingresos').set(directora)).body as ReporteIngresos;
    expect(reporte.eventos.some((e) => e.estudiante === 'Romero, Santiago' && e.tipo === 'INGRESO')).toBe(true);
    expect(reporte.porSede.find((s) => s.sede === 'Sede Centro')!.ingresos).toBeGreaterThan(0);
    expect(reporte.porFranja.length).toBeGreaterThan(0);
  });

  it('un QR de asistencia no sirve como QR de puerta', async () => {
    const { qr } = await sesionAbiertaDeHoy(await login('docente1@presente.edu.ar'), 'Programación II');
    const tel = await telefonoValidado('43890128', 'M');
    expect((await tel.escanearPuerta(qr)).body.codigo).toBe('QR_INVALIDO');
  });
});

describe('reportes', () => {
  it('dashboard: el docente no ve datos institucionales; el directivo sí', async () => {
    const d = (await request(app).get('/reportes/dashboard').set(await login('docente1@presente.edu.ar'))).body;
    expect(d.sesionesHoy).toBeGreaterThan(0);
    expect(d.ingresosHoy).toBeNull();
    expect(typeof d.asistenciaSemanaPct).toBe('number');

    const dir = (await request(app).get('/reportes/dashboard').set(await login('directora@presente.edu.ar'))).body;
    expect(dir.ingresosHoy).toEqual(expect.any(Number));
    expect(dir.validacionesPendientes).toEqual(expect.any(Number));
  });

  it('grilla de asistencia en JSON y CSV, con control de acceso', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const cursos = (await request(app).get('/cursos').set(docente)).body as Array<{ id: string; codigo: string }>;
    const prog = cursos.find((c) => c.codigo === 'PROG2')!;

    const grilla = (await request(app).get(`/reportes/asistencia?cursoId=${prog.id}`).set(docente)).body;
    expect(grilla.sesiones.length).toBeGreaterThan(0);
    expect(grilla.filas).toHaveLength(15);

    const csv = await request(app).get(`/reportes/asistencia?cursoId=${prog.id}&formato=csv`).set(docente);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n')[0]).toContain('Apellido,Nombre,Legajo');

    const otro = await login('docente2@presente.edu.ar');
    expect((await request(app).get(`/reportes/asistencia?cursoId=${prog.id}`).set(otro)).status).toBe(404);
  });
});
