// Reportes del backoffice: dashboard, grilla de asistencia (con CSV) e ingresos por sede/franja.
import { Router } from 'express';
import type { Dashboard, GrillaAsistencia, MetodoAsistencia, ReporteIngresos, TipoIngreso, TipoSesion } from '@presente/shared';
import { clock } from '../../lib/clock';
import { HttpError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { authStaff } from '../../middleware/authStaff';
import { cursoConAcceso, cursosVisibles, listarSesiones, rangoDelDia } from '../sesiones/service';

export const reportesRouter = Router();
reportesRouter.use(authStaff());

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

reportesRouter.get('/dashboard', async (req, res) => {
  const staff = req.staff!;
  const ahora = clock.now();
  const hoy = await listarSesiones({ inicio: rangoDelDia(), curso: cursosVisibles(staff) });
  const semana = await listarSesiones({
    fin: { gte: new Date(ahora.getTime() - 7 * 86_400_000), lt: ahora },
    curso: cursosVisibles(staff),
  });
  const esDirectivo = staff.rol === 'DIRECTIVO';
  const [ingresosHoy, validacionesPendientes, solicitudesPendientes] = esDirectivo
    ? await Promise.all([
        prisma.eventoIngreso.count({ where: { tipo: 'INGRESO', timestamp: rangoDelDia() } }),
        prisma.validacionIdentidad.count({ where: { resultado: 'EN_REVISION', resueltaAt: null } }),
        prisma.solicitudCambioDispositivo.count({ where: { estado: 'PENDIENTE' } }),
      ])
    : [null, null, null];

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const body: Dashboard = {
    sesionesHoy: hoy.length,
    presentesHoy: sum(hoy.map((s) => s.presentes)),
    esperadosHoy: sum(hoy.map((s) => s.inscriptos)),
    asistenciaSemanaPct: pct(sum(semana.map((s) => s.presentes)), sum(semana.map((s) => s.inscriptos))),
    ingresosHoy,
    validacionesPendientes,
    solicitudesPendientes,
  };
  res.json(body);
});

/** Grilla estudiante × sesión de un curso (sesiones ya empezadas). `?formato=csv` la descarga. */
reportesRouter.get('/asistencia', async (req, res) => {
  if (typeof req.query.cursoId !== 'string') throw new HttpError(400, 'Falta cursoId', 'DATOS_INVALIDOS');
  const curso = await cursoConAcceso(req.staff!, req.query.cursoId);
  const [sesiones, inscripciones] = await Promise.all([
    prisma.sesion.findMany({ where: { cursoId: curso.id, inicio: { lte: clock.now() } }, orderBy: { inicio: 'asc' }, include: { asistencias: true } }),
    prisma.inscripcion.findMany({ where: { cursoId: curso.id }, include: { estudiante: { include: { usuario: true } } } }),
  ]);

  const grilla: GrillaAsistencia = {
    curso: curso.nombre,
    sesiones: sesiones.map((s) => ({ id: s.id, inicio: s.inicio.toISOString(), tipo: s.tipo as TipoSesion })),
    filas: inscripciones
      .map(({ estudiante: e }) => {
        const celdas: Record<string, MetodoAsistencia | null> = {};
        for (const s of sesiones) celdas[s.id] = (s.asistencias.find((a) => a.estudianteId === e.id)?.metodo as MetodoAsistencia) ?? null;
        const presentes = Object.values(celdas).filter(Boolean).length;
        return { estudianteId: e.id, apellido: e.usuario.apellido, nombre: e.usuario.nombre, legajo: e.legajo, celdas, porcentaje: pct(presentes, sesiones.length) };
      })
      .sort((a, b) => a.apellido.localeCompare(b.apellido)),
  };

  if (req.query.formato !== 'csv') {
    res.json(grilla);
    return;
  }
  // CSV: P = presente por QR, M = presente cargado a mano, A = ausente.
  const celda = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fecha = (iso: string, tipo: string) => `${new Date(iso).toLocaleDateString('es-AR')}${tipo === 'EXAMEN' ? ' (examen)' : ''}`;
  const lineas = [
    ['Apellido', 'Nombre', 'Legajo', ...grilla.sesiones.map((s) => fecha(s.inicio, s.tipo)), '% asistencia'],
    ...grilla.filas.map((f) => [
      f.apellido,
      f.nombre,
      f.legajo,
      ...grilla.sesiones.map((s) => (f.celdas[s.id] === 'QR' ? 'P' : f.celdas[s.id] === 'MANUAL' ? 'M' : 'A')),
      f.porcentaje === null ? '' : String(f.porcentaje),
    ]),
  ];
  res
    .type('text/csv; charset=utf-8')
    .attachment(`asistencia-${curso.codigo}.csv`)
    .send('﻿' + lineas.map((l) => l.map(celda).join(',')).join('\n')); // BOM para que Excel respete los acentos
});

/** Ingresos de un día: totales por sede, por franja horaria y detalle. Solo directivos. */
reportesRouter.get('/ingresos', authStaff('DIRECTIVO'), async (req, res) => {
  const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
  const sedeId = typeof req.query.sedeId === 'string' && req.query.sedeId ? req.query.sedeId : undefined;
  const rango = rangoDelDia(fecha);
  const eventos = await prisma.eventoIngreso.findMany({
    where: { timestamp: rango, puntoAcceso: sedeId ? { sedeId } : undefined },
    orderBy: { timestamp: 'desc' },
    include: { puntoAcceso: { include: { sede: true } }, estudiante: { include: { usuario: true } } },
  });

  const porSede = new Map<string, { ingresos: number; egresos: number; estudiantes: Set<string> }>();
  const porFranja = new Map<number, number>();
  for (const e of eventos) {
    const s = porSede.get(e.puntoAcceso.sede.nombre) ?? { ingresos: 0, egresos: 0, estudiantes: new Set() };
    if (e.tipo === 'INGRESO') {
      s.ingresos++;
      porFranja.set(e.timestamp.getHours(), (porFranja.get(e.timestamp.getHours()) ?? 0) + 1);
    } else s.egresos++;
    s.estudiantes.add(e.estudianteId);
    porSede.set(e.puntoAcceso.sede.nombre, s);
  }

  const body: ReporteIngresos = {
    fecha: rango.gte.toISOString(),
    porSede: [...porSede].map(([sede, v]) => ({ sede, ingresos: v.ingresos, egresos: v.egresos, estudiantes: v.estudiantes.size })),
    porFranja: [...porFranja].map(([hora, ingresos]) => ({ hora, ingresos })).sort((a, b) => a.hora - b.hora),
    eventos: eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo as TipoIngreso,
      timestamp: e.timestamp.toISOString(),
      sede: e.puntoAcceso.sede.nombre,
      punto: e.puntoAcceso.nombre,
      estudiante: `${e.estudiante.usuario.apellido}, ${e.estudiante.usuario.nombre}`,
      legajo: e.estudiante.legajo,
    })),
  };
  res.json(body);
});
