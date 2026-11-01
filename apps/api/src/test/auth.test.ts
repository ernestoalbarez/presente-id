import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { PASSWORD_DEMO } from '../../prisma/seed';

const app = createApp();

const login = (email: string, password = PASSWORD_DEMO) => request(app).post('/auth/login').send({ email, password });

describe('auth del backoffice', () => {
  it('loguea a un docente y devuelve token + usuario sin datos sensibles', async () => {
    const res = await login('docente1@presente.edu.ar');
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ email: 'docente1@presente.edu.ar', rol: 'DOCENTE' });
    expect(res.body.usuario.passwordHash).toBeUndefined();
  });

  it('normaliza el email (mayúsculas y espacios)', async () => {
    const res = await login('  Directora@Presente.edu.ar ');
    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('DIRECTIVO');
  });

  it('rechaza contraseña incorrecta y usuarios inexistentes con el mismo mensaje', async () => {
    const mal = await login('docente1@presente.edu.ar', 'otra');
    const inexistente = await login('nadie@presente.edu.ar');
    expect(mal.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mal.body.error).toBe(inexistente.body.error);
  });

  it('valida el body con zod', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'no-es-email' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('GET /auth/me exige token válido', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me').set('Authorization', 'Bearer basura')).status).toBe(401);

    const { body } = await login('docente2@presente.edu.ar');
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.usuario.email).toBe('docente2@presente.edu.ar');
  });
});
