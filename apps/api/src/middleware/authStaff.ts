// Autenticación del backoffice: Bearer token tipo "staff" + chequeo de rol.
import type { RequestHandler } from 'express';
import type { RolStaff, UsuarioStaff } from '@presente/shared';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verificarToken } from '../lib/tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: UsuarioStaff;
    }
  }
}

export function tokenDeRequest(header: string | undefined): string {
  const [esquema, token] = (header ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) throw new HttpError(401, 'Falta el token de sesión', 'NO_AUTENTICADO');
  return token;
}

/** Exige un usuario de staff logueado; si se pasan roles, además exige uno de ellos. */
export function authStaff(...roles: RolStaff[]): RequestHandler {
  return async (req, _res, next) => {
    const token = tokenDeRequest(req.headers.authorization);
    let sub: string | undefined;
    try {
      ({ sub } = await verificarToken('staff', token));
    } catch {
      throw new HttpError(401, 'Sesión inválida o vencida', 'NO_AUTENTICADO');
    }
    const usuario = sub ? await prisma.usuario.findUnique({ where: { id: sub } }) : null;
    if (!usuario || usuario.estado !== 'ACTIVO' || usuario.rol === 'ESTUDIANTE' || !usuario.email) {
      throw new HttpError(401, 'Sesión inválida o vencida', 'NO_AUTENTICADO');
    }
    const rol = usuario.rol as RolStaff;
    if (roles.length > 0 && !roles.includes(rol)) {
      throw new HttpError(403, 'No tenés permiso para esta acción', 'SIN_PERMISO');
    }
    req.staff = { id: usuario.id, email: usuario.email, nombre: usuario.nombre, apellido: usuario.apellido, rol };
    next();
  };
}
