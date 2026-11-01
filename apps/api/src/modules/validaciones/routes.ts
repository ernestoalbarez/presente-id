// Revisión manual de validaciones de identidad que el mock de RENAPER dejó EN_REVISION.
import { Router } from 'express';
import { z } from 'zod';
import { auditar } from '../../lib/audit';
import { clock } from '../../lib/clock';
import { HttpError, parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { authStaff } from '../../middleware/authStaff';
import { vincularDispositivo } from '../dispositivos/service';

export const validacionesRouter = Router();
validacionesRouter.use(authStaff('DIRECTIVO'));

const motivoSchema = z.object({ motivo: z.string().trim().max(300).optional() });

/** Validaciones en revisión sin resolver, con los datos del padrón para comparar. */
validacionesRouter.get('/', async (_req, res) => {
  const validaciones = await prisma.validacionIdentidad.findMany({
    where: { resultado: 'EN_REVISION', resueltaAt: null },
    orderBy: { createdAt: 'asc' },
    include: { estudiante: { include: { usuario: true } }, dispositivo: true },
  });
  const personas = await prisma.personaRenaper.findMany({ where: { dni: { in: validaciones.map((v) => v.dni) } } });
  res.json(
    validaciones.map((v) => {
      const p = personas.find((x) => x.dni === v.dni);
      return {
        id: v.id,
        dni: v.dni,
        motivo: v.motivo,
        createdAt: v.createdAt,
        estudiante: v.estudiante && {
          nombre: v.estudiante.usuario.nombre,
          apellido: v.estudiante.usuario.apellido,
          legajo: v.estudiante.legajo,
          carrera: v.estudiante.carrera,
        },
        renaper: p && { nombre: p.nombre, apellido: p.apellido, fechaNac: p.fechaNac, fotoUrl: p.fotoUrl },
        dispositivo: v.dispositivo && { modelo: v.dispositivo.modelo, estado: v.dispositivo.estado },
      };
    }),
  );
});

async function buscarPendiente(id: string) {
  const v = await prisma.validacionIdentidad.findUnique({ where: { id }, include: { estudiante: true } });
  if (!v || v.resultado !== 'EN_REVISION' || v.resueltaAt) throw new HttpError(404, 'La validación no está pendiente de revisión', 'NO_ENCONTRADO');
  if (!v.estudiante || !v.dispositivoId) throw new HttpError(409, 'La validación no tiene estudiante o dispositivo asociado', 'DATOS_INCONSISTENTES');
  return { ...v, estudiante: v.estudiante, dispositivoId: v.dispositivoId };
}

validacionesRouter.post('/:id/aprobar', async (req, res) => {
  const { motivo } = parse(motivoSchema, req.body ?? {});
  const v = await buscarPendiente(req.params.id);
  const vinculo = await prisma.$transaction(async (tx) => {
    await tx.validacionIdentidad.update({
      where: { id: v.id },
      data: { resultado: 'APROBADO', motivo: motivo ?? v.motivo, resueltaPorId: req.staff!.id, resueltaAt: clock.now() },
    });
    await tx.estudiante.update({ where: { id: v.estudiante.id }, data: { estadoValidacion: 'VALIDADO' } });
    return vincularDispositivo(tx, v.estudiante.usuarioId, v.dispositivoId);
  });
  await auditar({ actorId: req.staff!.id, accion: 'VALIDACION_APROBADA', entidad: 'ValidacionIdentidad', entidadId: v.id, detalle: { dni: v.dni, motivo, vinculo: vinculo.resultado } });
  res.json({ ok: true, dispositivo: vinculo.resultado });
});

validacionesRouter.post('/:id/rechazar', async (req, res) => {
  const { motivo } = parse(motivoSchema, req.body ?? {});
  const v = await buscarPendiente(req.params.id);
  const ahora = clock.now();
  await prisma.$transaction([
    prisma.validacionIdentidad.update({
      where: { id: v.id },
      data: { resultado: 'RECHAZADO', motivo: motivo ?? 'Rechazada en revisión manual', resueltaPorId: req.staff!.id, resueltaAt: ahora },
    }),
    prisma.estudiante.update({
      where: { id: v.estudiante.id },
      data: { estadoValidacion: v.estudiante.estadoValidacion === 'VALIDADO' ? 'VALIDADO' : 'RECHAZADO' },
    }),
    prisma.dispositivo.update({ where: { id: v.dispositivoId }, data: { estado: 'REVOCADO', revocadoAt: ahora } }),
  ]);
  await auditar({ actorId: req.staff!.id, accion: 'VALIDACION_RECHAZADA', entidad: 'ValidacionIdentidad', entidadId: v.id, detalle: { dni: v.dni, motivo } });
  res.json({ ok: true });
});
