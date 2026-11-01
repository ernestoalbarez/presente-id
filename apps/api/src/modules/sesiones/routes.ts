import { Router } from 'express';
import { correccionAsistenciaSchema, ROTACION_QR_ASISTENCIA_S, TYP_QR_ASISTENCIA, type QrAsistenciaResponse } from '@presente/shared';
import { auditar } from '../../lib/audit';
import { clock } from '../../lib/clock';
import { HttpError, parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { firmarToken } from '../../lib/tokens';
import { authStaff } from '../../middleware/authStaff';
import { emitirConstancia, revocarConstanciaDe } from '../constancias/service';
import { cursosVisibles, detalleSesion, listarSesiones, rangoDelDia, sesionConAcceso } from './service';

export const sesionesRouter = Router();
sesionesRouter.use(authStaff());

/**
 * El token del QR de asistencia vale el doble de la rotación (2 × 15 s): así se acepta el QR
 * actual y el anterior, y un estudiante que escaneó justo antes de la rotación no queda afuera.
 */
export const VIDA_QR_ASISTENCIA_S = ROTACION_QR_ASISTENCIA_S * 2;

/** Sesiones de un día (por defecto hoy) de los cursos visibles. */
sesionesRouter.get('/', async (req, res) => {
  const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
  res.json(await listarSesiones({ inicio: rangoDelDia(fecha), curso: cursosVisibles(req.staff!) }));
});

sesionesRouter.get('/:id', async (req, res) => {
  const sesion = await sesionConAcceso(req.staff!, req.params.id);
  res.json(await detalleSesion(sesion.id));
});

sesionesRouter.post('/:id/abrir', async (req, res) => {
  const sesion = await sesionConAcceso(req.staff!, req.params.id);
  await prisma.sesion.update({ where: { id: sesion.id }, data: { abiertaAt: clock.now(), cerradaAt: null } });
  await auditar({ actorId: req.staff!.id, accion: 'SESION_ABIERTA', entidad: 'Sesion', entidadId: sesion.id });
  res.json(await detalleSesion(sesion.id));
});

sesionesRouter.post('/:id/cerrar', async (req, res) => {
  const sesion = await sesionConAcceso(req.staff!, req.params.id);
  await prisma.sesion.update({ where: { id: sesion.id }, data: { cerradaAt: clock.now() } });
  await auditar({ actorId: req.staff!.id, accion: 'SESION_CERRADA', entidad: 'Sesion', entidadId: sesion.id });
  res.json(await detalleSesion(sesion.id));
});

/** QR de asistencia vigente. El backoffice lo pide cada 15 s mientras lo proyecta. */
sesionesRouter.get('/:id/qr', async (req, res) => {
  const sesion = await sesionConAcceso(req.staff!, req.params.id);
  if (!sesion.abiertaAt || sesion.cerradaAt) throw new HttpError(409, 'La sesión no está abierta', 'SESION_NO_ABIERTA');
  const qr = await firmarToken(TYP_QR_ASISTENCIA, { sid: sesion.id }, VIDA_QR_ASISTENCIA_S);
  res.json({ qr, rotaEnSeg: ROTACION_QR_ASISTENCIA_S } satisfies QrAsistenciaResponse);
});

/** Corrección manual del presente de un estudiante. Queda auditada con el motivo. */
sesionesRouter.put('/:id/asistencias/:estudianteId', async (req, res) => {
  const sesion = await sesionConAcceso(req.staff!, req.params.id);
  const { presente, motivo } = parse(correccionAsistenciaSchema, req.body);
  const { estudianteId } = req.params;
  const inscripto = await prisma.inscripcion.findUnique({ where: { estudianteId_cursoId: { estudianteId, cursoId: sesion.cursoId } } });
  if (!inscripto) throw new HttpError(404, 'El estudiante no está inscripto en el curso', 'NO_INSCRIPTO_CURSO');

  const actual = await prisma.asistencia.findUnique({ where: { estudianteId_sesionId: { estudianteId, sesionId: sesion.id } } });
  if (presente && !actual) {
    await prisma.$transaction(async (tx) => {
      const a = await tx.asistencia.create({
        data: { estudianteId, sesionId: sesion.id, metodo: 'MANUAL', registradaPorId: req.staff!.id, timestamp: clock.now() },
      });
      await emitirConstancia(tx, a.id);
    });
  } else if (!presente && actual) {
    // La constancia no se borra: queda revocada y desvinculada de la asistencia eliminada.
    await prisma.$transaction(async (tx) => {
      await revocarConstanciaDe(tx, actual.id);
      await tx.asistencia.delete({ where: { id: actual.id } });
    });
  }
  if (presente !== !!actual) {
    await auditar({
      actorId: req.staff!.id,
      accion: presente ? 'ASISTENCIA_MARCADA_MANUAL' : 'ASISTENCIA_ANULADA_MANUAL',
      entidad: 'Asistencia',
      entidadId: actual?.id,
      detalle: { sesionId: sesion.id, estudianteId, motivo, anterior: actual && { metodo: actual.metodo, timestamp: actual.timestamp } },
    });
  }
  res.json(await detalleSesion(sesion.id));
});
