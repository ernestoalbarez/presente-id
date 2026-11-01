import { prisma } from './prisma';

/** Registra una acción sensible en la tabla Auditoria. */
export async function auditar(params: {
  actorId?: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  detalle?: unknown;
}) {
  await prisma.auditoria.create({
    data: {
      actorId: params.actorId,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId,
      detalle: params.detalle === undefined ? undefined : JSON.stringify(params.detalle),
    },
  });
}
