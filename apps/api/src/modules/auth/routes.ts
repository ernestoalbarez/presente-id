import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, type LoginResponse, type RolStaff } from '@presente/shared';
import { config } from '../../config';
import { HttpError, parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { firmarToken } from '../../lib/tokens';
import { authStaff } from '../../middleware/authStaff';

export const authRouter = Router();

// Login del backoffice. Los estudiantes no tienen login web: aunque existan como Usuario,
// no tienen email/contraseña y además se rechaza el rol explícitamente.
authRouter.post('/login', async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const ok =
    usuario?.passwordHash &&
    usuario.rol !== 'ESTUDIANTE' &&
    usuario.estado === 'ACTIVO' &&
    (await bcrypt.compare(password, usuario.passwordHash));
  if (!ok || !usuario) throw new HttpError(401, 'Email o contraseña incorrectos', 'CREDENCIALES_INVALIDAS');

  const token = await firmarToken('staff', { sub: usuario.id, rol: usuario.rol }, config.staffTokenTtlHoras * 3600);
  const body: LoginResponse = {
    token,
    usuario: { id: usuario.id, email: usuario.email!, nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol as RolStaff },
  };
  res.json(body);
});

authRouter.get('/me', authStaff(), (req, res) => {
  res.json({ usuario: req.staff });
});
