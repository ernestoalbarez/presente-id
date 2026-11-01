import { importJWK, compactVerify } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { PresenteResponse, SesionDetalle } from '@presente/shared';
import { prisma } from '../lib/prisma';
import { app, login, sesionAbiertaDeHoy, telefonoValidado } from './helpers';

describe('constancias de presencia', () => {
  it('cada presente emite una constancia verificable públicamente, sin datos sensibles', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const { id: sesionId, qr } = await sesionAbiertaDeHoy(docente, 'Programación II');
    const tel = await telefonoValidado('43789017', 'F'); // Martina Pérez

    const presente = (await tel.escanearAsistencia(qr).expect(201)).body as PresenteResponse;
    expect(presente.constancia.codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(presente.constancia.urlVerificacion).toContain(`/verificar/${presente.constancia.codigo}`);

    const pub = await request(app).get(`/public/constancias/${presente.constancia.codigo}`); // sin login
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ autentica: true, revocada: false, constancia: { curso: 'Programación II', titular: 'Martina P.', tipo: 'CLASE' } });
    expect(JSON.stringify(pub.body)).not.toContain('43789017'); // no expone el DNI

    // La app la ve en su galería.
    const galeria = (await tel.get('/yo/constancias')).body as Array<{ codigo: string }>;
    expect(galeria.map((c) => c.codigo)).toContain(presente.constancia.codigo);
    const sesion = (await request(app).get(`/sesiones/${sesionId}`).set(docente)).body as SesionDetalle;
    expect(sesion.asistencias.find((a) => a.nombre === 'Martina')?.asistencia?.metodo).toBe('QR');
  });

  it('cualquiera puede verificar la firma con la clave pública del servidor', async () => {
    const c = await prisma.constancia.findFirstOrThrow();
    const jwk = (await request(app).get('/public/clave-servidor')).body;
    const { payload } = await compactVerify(c.firma, await importJWK(jwk, 'EdDSA'));
    expect(new TextDecoder().decode(payload)).toBe(c.payload);
  });

  it('detecta una constancia adulterada en la base', async () => {
    const c = await prisma.constancia.findFirstOrThrow({ where: { revocada: false } });
    const adulterado = JSON.stringify({ ...JSON.parse(c.payload), curso: 'Materia inventada' });
    await prisma.constancia.update({ where: { id: c.id }, data: { payload: adulterado } });
    const pub = await request(app).get(`/public/constancias/${c.codigo}`);
    expect(pub.body).toMatchObject({ autentica: false });
    expect(pub.body.constancia).toBeUndefined();
    await prisma.constancia.update({ where: { id: c.id }, data: { payload: c.payload } }); // restaurar
  });

  it('al anular el presente la constancia queda revocada y sale de la galería', async () => {
    const docente = await login('docente1@presente.edu.ar');
    const { id: sesionId } = await sesionAbiertaDeHoy(docente, 'Programación II');
    const det = (await request(app).get(`/sesiones/${sesionId}`).set(docente)).body as SesionDetalle;
    const martina = det.asistencias.find((a) => a.nombre === 'Martina')!;
    const constancia = await prisma.constancia.findFirstOrThrow({ where: { estudianteId: martina.estudianteId, revocada: false, asistencia: { sesionId } } });

    await request(app).put(`/sesiones/${sesionId}/asistencias/${martina.estudianteId}`).set(docente).send({ presente: false, motivo: 'Se fue antes' }).expect(200);

    const pub = await request(app).get(`/public/constancias/${constancia.codigo}`);
    expect(pub.body).toMatchObject({ autentica: true, revocada: true });
  });

  it('un código inexistente no es auténtico', async () => {
    expect((await request(app).get('/public/constancias/ZZZZ-ZZZZ')).body).toMatchObject({ autentica: false });
  });
});
