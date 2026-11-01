// Regla central: UN dispositivo ACTIVO por usuario.
import type { Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';

type Tx = Prisma.TransactionClient;

/**
 * Intenta activar un dispositivo PENDIENTE recién validado:
 * - si el usuario no tiene otro dispositivo activo, lo activa;
 * - si ya tiene uno, crea una solicitud de cambio para que la apruebe un directivo
 *   (y descarta solicitudes anteriores sin resolver, revocando esos teléfonos).
 */
export async function vincularDispositivo(
  tx: Tx,
  usuarioId: string,
  dispositivoId: string,
): Promise<{ resultado: 'ACTIVADO' } | { resultado: 'CAMBIO_PENDIENTE'; solicitudId: string }> {
  const ahora = clock.now();
  const activo = await tx.dispositivo.findFirst({ where: { usuarioId, estado: 'ACTIVO', id: { not: dispositivoId } } });

  if (!activo) {
    await tx.dispositivo.update({ where: { id: dispositivoId }, data: { estado: 'ACTIVO', activadoAt: ahora } });
    return { resultado: 'ACTIVADO' };
  }

  const viejas = await tx.solicitudCambioDispositivo.findMany({
    where: { usuarioId, estado: 'PENDIENTE', dispositivoNuevoId: { not: dispositivoId } },
  });
  for (const s of viejas) {
    await tx.solicitudCambioDispositivo.update({ where: { id: s.id }, data: { estado: 'RECHAZADA', resueltaAt: ahora } });
    await tx.dispositivo.update({ where: { id: s.dispositivoNuevoId }, data: { estado: 'REVOCADO', revocadoAt: ahora } });
  }

  const existente = await tx.solicitudCambioDispositivo.findFirst({
    where: { dispositivoNuevoId: dispositivoId, estado: 'PENDIENTE' },
  });
  const solicitud =
    existente ??
    (await tx.solicitudCambioDispositivo.create({
      data: { usuarioId, dispositivoNuevoId: dispositivoId, dispositivoAnteriorId: activo.id },
    }));
  return { resultado: 'CAMBIO_PENDIENTE', solicitudId: solicitud.id };
}
