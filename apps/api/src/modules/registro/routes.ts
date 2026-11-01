// Registro desde la app: validación de identidad (mock RENAPER) + vinculación del dispositivo.
import { Router } from 'express';
import {
  registroSchema,
  type PerfilEstudiante,
  type RegistroResponse,
  type SituacionDispositivo,
  type EstadoValidacion,
} from '@presente/shared';
import { identityProvider } from '../../identity';
import { auditar } from '../../lib/audit';
import { clock } from '../../lib/clock';
import { HttpError, parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { firmarToken } from '../../lib/tokens';
import { authDevice } from '../../middleware/authDevice';
import { vincularDispositivo } from '../dispositivos/service';

const DEVICE_TOKEN_TTL_S = 30 * 24 * 3600;

export const registroRouter = Router();

registroRouter.post('/registro', async (req, res) => {
  const datos = parse(registroSchema, req.body);
  const validacion = await identityProvider.validar(datos);
  const estudiante = await prisma.estudiante.findUnique({ where: { dni: datos.dni } });

  // La identidad puede ser real (RENAPER) pero la persona no estar en el padrón de la institución.
  if (!estudiante) {
    await prisma.validacionIdentidad.create({ data: { dni: datos.dni, resultado: validacion.resultado, motivo: validacion.motivo } });
    if (validacion.resultado === 'RECHAZADO') {
      res.json({ estado: 'RECHAZADO', motivo: validacion.motivo } satisfies RegistroResponse);
      return;
    }
    throw new HttpError(404, 'No estás inscripto en la institución', 'NO_INSCRIPTO');
  }

  // Un intento fallido no le quita el estado VALIDADO a quien ya lo tenía
  // (si no, cualquiera que conozca un DNI podría "des-validar" a otro estudiante).
  const nuevoEstado = (e: EstadoValidacion) => (estudiante.estadoValidacion === 'VALIDADO' ? 'VALIDADO' : e);

  if (validacion.resultado === 'RECHAZADO') {
    await prisma.$transaction([
      prisma.validacionIdentidad.create({
        data: { estudianteId: estudiante.id, dni: datos.dni, resultado: 'RECHAZADO', motivo: validacion.motivo },
      }),
      prisma.estudiante.update({ where: { id: estudiante.id }, data: { estadoValidacion: nuevoEstado('RECHAZADO') } }),
    ]);
    res.json({ estado: 'RECHAZADO', motivo: validacion.motivo } satisfies RegistroResponse);
    return;
  }

  // Identidad aprobada o en revisión: registramos (o reutilizamos) el dispositivo.
  const existente = await prisma.dispositivo.findUnique({ where: { deviceId: datos.deviceId } });
  if (existente && (existente.usuarioId !== estudiante.usuarioId || existente.publicKey !== datos.publicKey)) {
    throw new HttpError(409, 'Este dispositivo ya está registrado a otra identidad', 'DISPOSITIVO_EN_USO');
  }
  if (existente?.estado === 'REVOCADO') {
    throw new HttpError(409, 'Este dispositivo fue revocado. Desvinculalo y volvé a registrarte.', 'DISPOSITIVO_REVOCADO');
  }

  const respuesta = await prisma.$transaction(async (tx): Promise<RegistroResponse> => {
    const dispositivo =
      existente ??
      (await tx.dispositivo.create({
        data: { usuarioId: estudiante.usuarioId, deviceId: datos.deviceId, publicKey: datos.publicKey, modelo: datos.modelo },
      }));
    await tx.validacionIdentidad.create({
      data: {
        estudianteId: estudiante.id,
        dni: datos.dni,
        dispositivoId: dispositivo.id,
        resultado: validacion.resultado,
        motivo: validacion.motivo,
      },
    });
    const deviceToken = await firmarToken('dispositivo', { sub: estudiante.usuarioId, did: dispositivo.deviceId }, DEVICE_TOKEN_TTL_S);

    if (validacion.resultado === 'EN_REVISION') {
      await tx.estudiante.update({ where: { id: estudiante.id }, data: { estadoValidacion: nuevoEstado('EN_REVISION') } });
      return { estado: 'EN_REVISION', motivo: validacion.motivo, deviceToken };
    }

    await tx.estudiante.update({ where: { id: estudiante.id }, data: { estadoValidacion: 'VALIDADO' } });
    if (dispositivo.estado === 'ACTIVO') return { estado: 'VALIDADO', deviceToken };

    const vinculo = await vincularDispositivo(tx, estudiante.usuarioId, dispositivo.id);
    if (vinculo.resultado === 'ACTIVADO') return { estado: 'VALIDADO', deviceToken };
    return { estado: 'CAMBIO_DISPOSITIVO_PENDIENTE', deviceToken };
  });

  if (respuesta.estado === 'VALIDADO' || respuesta.estado === 'CAMBIO_DISPOSITIVO_PENDIENTE') {
    await auditar({
      actorId: estudiante.usuarioId,
      accion: respuesta.estado === 'VALIDADO' ? 'DISPOSITIVO_VINCULADO' : 'SOLICITUD_CAMBIO_DISPOSITIVO',
      entidad: 'Dispositivo',
      entidadId: datos.deviceId,
      detalle: { modelo: datos.modelo },
    });
  }
  res.json(respuesta);
});

/** Perfil + situación del teléfono que consulta. La app lo consulta (polling) mientras espera aprobación. */
registroRouter.get('/yo', authDevice({ permitirNoActivo: true }), async (req, res) => {
  const { dispositivo, usuario, estudiante } = req.sesionDispositivo!;

  let situacion: SituacionDispositivo;
  let motivo: string | undefined;
  if (dispositivo.estado === 'ACTIVO') {
    situacion = 'ACTIVO';
  } else if (dispositivo.estado === 'REVOCADO') {
    const ultima = await prisma.validacionIdentidad.findFirst({
      where: { dispositivoId: dispositivo.id },
      orderBy: { createdAt: 'desc' },
    });
    situacion = ultima?.resultado === 'RECHAZADO' ? 'RECHAZADO' : 'REVOCADO';
    motivo = ultima?.resultado === 'RECHAZADO' ? (ultima.motivo ?? undefined) : 'Este teléfono fue desvinculado de tu cuenta';
  } else {
    const solicitud = await prisma.solicitudCambioDispositivo.findFirst({
      where: { dispositivoNuevoId: dispositivo.id, estado: 'PENDIENTE' },
    });
    situacion = solicitud ? 'CAMBIO_PENDIENTE' : 'EN_REVISION';
  }

  const institucion = await prisma.institucion.findFirst();
  const perfil: PerfilEstudiante = {
    usuarioId: usuario.id,
    institucion: institucion?.nombre ?? '',
    ahoraServidor: clock.now().toISOString(),
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    dni: estudiante.dni,
    legajo: estudiante.legajo,
    carrera: estudiante.carrera,
    fotoUrl: estudiante.fotoUrl,
    estadoValidacion: estudiante.estadoValidacion as EstadoValidacion,
    situacion,
    motivo,
  };
  res.json(perfil);
});
