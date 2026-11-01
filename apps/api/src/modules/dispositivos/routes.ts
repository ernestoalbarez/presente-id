// Gestión de dispositivos por directivos: solicitudes de cambio y revocación.
import { Router } from 'express';
import { z } from 'zod';
import { auditar } from '../../lib/audit';
import { clock } from '../../lib/clock';
import { HttpError, parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { authStaff } from '../../middleware/authStaff';

export const dispositivosRouter = Router();
dispositivosRouter.use(authStaff('DIRECTIVO'));

const motivoSchema = z.object({ motivo: z.string().trim().max(300).optional() });

const resumenDispositivo = (d: { id: string; modelo: string | null; estado: string; createdAt: Date; activadoAt: Date | null } | null) =>
  d && { id: d.id, modelo: d.modelo, estado: d.estado, createdAt: d.createdAt, activadoAt: d.activadoAt };

dispositivosRouter.get('/solicitudes', async (_req, res) => {
  const solicitudes = await prisma.solicitudCambioDispositivo.findMany({
    where: { estado: 'PENDIENTE' },
    orderBy: { createdAt: 'asc' },
    include: { usuario: { include: { estudiante: true } }, dispositivoNuevo: true, dispositivoAnterior: true },
  });
  res.json(
    solicitudes.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      estudiante: {
        nombre: s.usuario.nombre,
        apellido: s.usuario.apellido,
        dni: s.usuario.estudiante?.dni,
        legajo: s.usuario.estudiante?.legajo,
        fotoUrl: s.usuario.estudiante?.fotoUrl,
      },
      dispositivoNuevo: resumenDispositivo(s.dispositivoNuevo),
      dispositivoAnterior: resumenDispositivo(s.dispositivoAnterior),
    })),
  );
});

async function solicitudPendiente(id: string) {
  const s = await prisma.solicitudCambioDispositivo.findUnique({ where: { id } });
  if (!s || s.estado !== 'PENDIENTE') throw new HttpError(404, 'La solicitud no está pendiente', 'NO_ENCONTRADO');
  return s;
}

/** Aprobar: el teléfono nuevo pasa a ACTIVO y se revoca cualquier otro activo del usuario. */
dispositivosRouter.post('/solicitudes/:id/aprobar', async (req, res) => {
  const s = await solicitudPendiente(req.params.id);
  const ahora = clock.now();
  await prisma.$transaction([
    prisma.dispositivo.updateMany({
      where: { usuarioId: s.usuarioId, estado: 'ACTIVO', id: { not: s.dispositivoNuevoId } },
      data: { estado: 'REVOCADO', revocadoAt: ahora },
    }),
    prisma.dispositivo.update({ where: { id: s.dispositivoNuevoId }, data: { estado: 'ACTIVO', activadoAt: ahora } }),
    prisma.solicitudCambioDispositivo.update({
      where: { id: s.id },
      data: { estado: 'APROBADA', resueltaPorId: req.staff!.id, resueltaAt: ahora },
    }),
  ]);
  await auditar({ actorId: req.staff!.id, accion: 'CAMBIO_DISPOSITIVO_APROBADO', entidad: 'SolicitudCambioDispositivo', entidadId: s.id, detalle: { usuarioId: s.usuarioId } });
  res.json({ ok: true });
});

dispositivosRouter.post('/solicitudes/:id/rechazar', async (req, res) => {
  const { motivo } = parse(motivoSchema, req.body ?? {});
  const s = await solicitudPendiente(req.params.id);
  const ahora = clock.now();
  await prisma.$transaction([
    prisma.dispositivo.update({ where: { id: s.dispositivoNuevoId }, data: { estado: 'REVOCADO', revocadoAt: ahora } }),
    prisma.solicitudCambioDispositivo.update({
      where: { id: s.id },
      data: { estado: 'RECHAZADA', resueltaPorId: req.staff!.id, resueltaAt: ahora },
    }),
  ]);
  await auditar({ actorId: req.staff!.id, accion: 'CAMBIO_DISPOSITIVO_RECHAZADO', entidad: 'SolicitudCambioDispositivo', entidadId: s.id, detalle: { usuarioId: s.usuarioId, motivo } });
  res.json({ ok: true });
});

/** Dispositivos activos (para poder revocarlos). */
dispositivosRouter.get('/', async (_req, res) => {
  const dispositivos = await prisma.dispositivo.findMany({
    where: { estado: 'ACTIVO' },
    orderBy: { activadoAt: 'desc' },
    include: { usuario: { include: { estudiante: true } } },
  });
  res.json(
    dispositivos.map((d) => ({
      ...resumenDispositivo(d),
      estudiante: { nombre: d.usuario.nombre, apellido: d.usuario.apellido, dni: d.usuario.estudiante?.dni, legajo: d.usuario.estudiante?.legajo },
    })),
  );
});

dispositivosRouter.post('/:id/revocar', async (req, res) => {
  const { motivo } = parse(motivoSchema, req.body ?? {});
  const d = await prisma.dispositivo.findUnique({ where: { id: req.params.id } });
  if (!d || d.estado !== 'ACTIVO') throw new HttpError(404, 'El dispositivo no está activo', 'NO_ENCONTRADO');
  await prisma.dispositivo.update({ where: { id: d.id }, data: { estado: 'REVOCADO', revocadoAt: clock.now() } });
  await auditar({ actorId: req.staff!.id, accion: 'DISPOSITIVO_REVOCADO', entidad: 'Dispositivo', entidadId: d.id, detalle: { usuarioId: d.usuarioId, motivo } });
  res.json({ ok: true });
});
