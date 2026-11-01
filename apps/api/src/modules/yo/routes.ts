// Historial y constancias del estudiante (app móvil).
import { Router } from 'express';
import type { HistorialApp, MetodoAsistencia, TipoIngreso, TipoSesion } from '@presente/shared';
import { prisma } from '../../lib/prisma';
import { authDevice } from '../../middleware/authDevice';
import { aConstanciaApp } from '../constancias/service';

export const yoRouter = Router();
yoRouter.use(authDevice());

yoRouter.get('/historial', async (req, res) => {
  const { estudiante } = req.sesionDispositivo!;
  const [asistencias, ingresos] = await Promise.all([
    prisma.asistencia.findMany({ where: { estudianteId: estudiante.id }, orderBy: { timestamp: 'desc' }, take: 50, include: { sesion: { include: { curso: true } } } }),
    prisma.eventoIngreso.findMany({ where: { estudianteId: estudiante.id }, orderBy: { timestamp: 'desc' }, take: 50, include: { puntoAcceso: { include: { sede: true } } } }),
  ]);
  const body: HistorialApp = {
    asistencias: asistencias.map((a) => ({
      id: a.id,
      curso: a.sesion.curso.nombre,
      tipo: a.sesion.tipo as TipoSesion,
      fecha: a.timestamp.toISOString(),
      metodo: a.metodo as MetodoAsistencia,
      verificadaPresencialmente: a.verificadaPresencialmente,
    })),
    ingresos: ingresos.map((i) => ({ id: i.id, tipo: i.tipo as TipoIngreso, sede: i.puntoAcceso.sede.nombre, punto: i.puntoAcceso.nombre, timestamp: i.timestamp.toISOString() })),
  };
  res.json(body);
});

/** Galería "Mis constancias": solo las vigentes. */
yoRouter.get('/constancias', async (req, res) => {
  const { estudiante } = req.sesionDispositivo!;
  const constancias = await prisma.constancia.findMany({ where: { estudianteId: estudiante.id, revocada: false }, orderBy: { emitidaAt: 'desc' } });
  res.json(constancias.map(aConstanciaApp));
});
