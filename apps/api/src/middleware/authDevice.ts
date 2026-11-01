// Autenticación de la app móvil. Un estudiante solo opera desde su teléfono vinculado:
// el token de sesión está atado a un deviceId y en CADA request se revisa en la base que
// ese dispositivo siga existiendo, pertenezca al usuario y esté ACTIVO. Así, revocar un
// dispositivo corta su acceso de inmediato aunque el token no haya vencido.
import type { Dispositivo, Estudiante, Usuario } from '@prisma/client';
import type { RequestHandler } from 'express';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verificarToken } from '../lib/tokens';
import { tokenDeRequest } from './authStaff';

export interface SesionDispositivo {
  dispositivo: Dispositivo;
  usuario: Usuario;
  estudiante: Estudiante;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sesionDispositivo?: SesionDispositivo;
    }
  }
}

/** @param permitirNoActivo deja pasar dispositivos PENDIENTE/REVOCADO (solo para consultar su estado). */
export function authDevice({ permitirNoActivo = false } = {}): RequestHandler {
  return async (req, _res, next) => {
    const token = tokenDeRequest(req.headers.authorization);
    let claims: { sub?: string; did?: string };
    try {
      claims = await verificarToken<{ did?: string }>('dispositivo', token);
    } catch {
      throw new HttpError(401, 'Sesión del dispositivo inválida', 'NO_AUTENTICADO');
    }
    const dispositivo = claims.did
      ? await prisma.dispositivo.findUnique({
          where: { deviceId: claims.did },
          include: { usuario: { include: { estudiante: true } } },
        })
      : null;
    if (!dispositivo || dispositivo.usuarioId !== claims.sub || !dispositivo.usuario.estudiante) {
      throw new HttpError(401, 'Dispositivo no registrado', 'NO_AUTENTICADO');
    }
    if (!permitirNoActivo && dispositivo.estado !== 'ACTIVO') {
      throw new HttpError(403, 'Este dispositivo no está activo', 'DISPOSITIVO_NO_ACTIVO');
    }
    const { usuario, ...disp } = dispositivo;
    req.sesionDispositivo = { dispositivo: disp, usuario, estudiante: usuario.estudiante! };
    next();
  };
}
