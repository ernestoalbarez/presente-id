// Modo demo (DEMO_MODE=true): adelantar el reloj del servidor y forzar estados para mostrar
// casos sin esperar (QR vencido, sesión fuera de horario, dispositivo revocado).
// Lo usan tanto el backoffice (staff) como la app (dispositivo). Todo queda auditado.
import { Router, type RequestHandler } from 'express';
import { demoRelojSchema, type EstadoDemo } from '@presente/shared';
import { config } from '../../config';
import { auditar } from '../../lib/audit';
import { clock } from '../../lib/clock';
import { HttpError, parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { verificarToken } from '../../lib/tokens';
import { authDevice } from '../../middleware/authDevice';
import { authStaff, tokenDeRequest } from '../../middleware/authStaff';

export const demoRouter = Router();

const soloDemo: RequestHandler = (_req, _res, next) => {
  if (!config.demoMode) throw new HttpError(404, 'El modo demo está desactivado', 'DEMO_DESACTIVADO');
  next();
};

/** Acepta una sesión de staff o de dispositivo; devuelve el id del actor (para auditar). */
const staffODispositivo: RequestHandler = async (req, res, next) => {
  const token = tokenDeRequest(req.headers.authorization);
  for (const tipo of ['staff', 'dispositivo'] as const) {
    try {
      const { sub } = await verificarToken(tipo, token);
      res.locals.actorId = sub;
      return next();
    } catch {
      /* probar el siguiente tipo */
    }
  }
  throw new HttpError(401, 'Sesión inválida', 'NO_AUTENTICADO');
};

const estado = (): EstadoDemo => ({ demoMode: config.demoMode, offsetMin: Math.round(clock.getOffsetMs() / 60_000), ahora: clock.now().toISOString() });

demoRouter.get('/estado', (_req, res) => {
  res.json(estado());
});

demoRouter.post('/reloj', soloDemo, staffODispositivo, async (req, res) => {
  const { offsetMin } = parse(demoRelojSchema, req.body);
  clock.setOffsetMs(offsetMin * 60_000);
  await auditar({ actorId: res.locals.actorId, accion: 'DEMO_RELOJ', entidad: 'Reloj', detalle: { offsetMin } });
  res.json(estado());
});

/** Mueve el fin de la sesión a un minuto atrás: los escaneos pasan a "Terminó el horario". */
demoRouter.post('/sesiones/:id/vencer', soloDemo, authStaff(), async (req, res) => {
  const id = String(req.params.id);
  const sesion = await prisma.sesion.findUnique({ where: { id } });
  if (!sesion) throw new HttpError(404, 'Sesión inexistente', 'NO_ENCONTRADO');
  const fin = new Date(clock.now().getTime() - 60_000);
  await prisma.sesion.update({ where: { id }, data: { fin, inicio: sesion.inicio < fin ? sesion.inicio : new Date(fin.getTime() - 3_600_000) } });
  await auditar({ actorId: req.staff!.id, accion: 'DEMO_SESION_VENCIDA', entidad: 'Sesion', entidadId: id });
  res.json({ ok: true });
});

/** Desde la app: revoca el propio teléfono para mostrar "DISPOSITIVO REVOCADO" con un solo celular. */
demoRouter.post('/mi-dispositivo/revocar', soloDemo, authDevice(), async (req, res) => {
  const { dispositivo, usuario } = req.sesionDispositivo!;
  await prisma.dispositivo.update({ where: { id: dispositivo.id }, data: { estado: 'REVOCADO', revocadoAt: clock.now() } });
  await auditar({ actorId: usuario.id, accion: 'DEMO_DISPOSITIVO_REVOCADO', entidad: 'Dispositivo', entidadId: dispositivo.id, detalle: { usuarioId: usuario.id } });
  res.json({ ok: true });
});
