import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../lib/errors';
import { firmarToken } from '../lib/tokens';
import { prisma } from '../lib/prisma';
import { authStaff } from '../middleware/authStaff';

// App mínima para probar el control de acceso por rol aislado de las rutas reales.
const app = express();
app.get('/solo-directivo', authStaff('DIRECTIVO'), (_req, res) => {
  res.json({ ok: true });
});
app.use(errorHandler);

const tokenDe = async (email: string) => {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
  return firmarToken('staff', { sub: u.id }, 60);
};

describe('authStaff', () => {
  it('permite el rol habilitado', async () => {
    const res = await request(app).get('/solo-directivo').set('Authorization', `Bearer ${await tokenDe('directora@presente.edu.ar')}`);
    expect(res.status).toBe(200);
  });

  it('devuelve 403 a otro rol de staff', async () => {
    const res = await request(app).get('/solo-directivo').set('Authorization', `Bearer ${await tokenDe('docente1@presente.edu.ar')}`);
    expect(res.status).toBe(403);
  });

  it('rechaza un token firmado para un estudiante', async () => {
    const est = await prisma.usuario.findFirstOrThrow({ where: { rol: 'ESTUDIANTE' } });
    const token = await firmarToken('staff', { sub: est.id }, 60);
    const res = await request(app).get('/solo-directivo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
