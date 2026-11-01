// Verificación de identidad desde el backoffice: el docente/directivo escanea el QR que
// muestra el estudiante y la API valida firma, vigencia, dispositivo y nonce.
import { Router } from 'express';
import {
  verificarIdentidadSchema,
  type EfectoEnSesion,
  type EstadoValidacion,
  type VerificacionIdentidadResponse,
  type VerificacionResumen,
} from '@presente/shared';
import { clock } from '../../lib/clock';
import { parse } from '../../lib/errors';
import { consumirNonce } from '../../lib/nonces';
import { prisma } from '../../lib/prisma';
import { authStaff } from '../../middleware/authStaff';
import { sesionConAcceso } from '../sesiones/service';
import { verificarQrIdentidad } from './qrIdentidad';

export const verificacionesRouter = Router();
verificacionesRouter.use(authStaff());

verificacionesRouter.post('/identidad', async (req, res) => {
  const { qr, sesionId } = parse(verificarIdentidadSchema, req.body);
  // Verificación dentro de una sesión (examen): el docente tiene que tener acceso a esa sesión.
  const sesion = sesionId ? await sesionConAcceso(req.staff!, sesionId) : null;
  const r = await verificarQrIdentidad(qr, {
    ahoraSeg: clock.nowSeconds(),
    buscarDispositivo: (deviceId) => prisma.dispositivo.findUnique({ where: { deviceId } }),
    consumirNonce,
  });

  const estudiante = r.dispositivo
    ? await prisma.estudiante.findUnique({
        where: { usuarioId: r.dispositivo.usuarioId },
        include: { usuario: true, inscripciones: { include: { curso: true } } },
      })
    : null;

  // Toda verificación queda registrada, también las fallidas.
  const registro = await prisma.verificacionIdentidad.create({
    data: {
      verificadorId: req.staff!.id,
      estudianteId: estudiante?.id,
      dispositivoId: r.dispositivo?.id,
      sesionId: sesion?.id,
      resultado: r.resultado,
      motivo: r.motivo,
      createdAt: clock.now(),
    },
  });

  // Verificación cruzada: si el QR es válido, marca el presente de esa sesión como verificado en persona.
  let efectoEnSesion: EfectoEnSesion | undefined;
  if (sesion && estudiante && r.resultado === 'VALIDO') {
    if (!estudiante.inscripciones.some((i) => i.cursoId === sesion.cursoId)) {
      efectoEnSesion = 'NO_INSCRIPTO';
    } else {
      const { count } = await prisma.asistencia.updateMany({
        where: { estudianteId: estudiante.id, sesionId: sesion.id },
        data: { verificadaPresencialmente: true },
      });
      efectoEnSesion = count > 0 ? 'VERIFICADA' : 'SIN_PRESENTE';
    }
  }

  const body: VerificacionIdentidadResponse = {
    id: registro.id,
    resultado: r.resultado,
    motivo: r.motivo,
    fecha: registro.createdAt.toISOString(),
    estudiante: estudiante
      ? {
          nombre: estudiante.usuario.nombre,
          apellido: estudiante.usuario.apellido,
          dni: estudiante.dni,
          legajo: estudiante.legajo,
          carrera: estudiante.carrera,
          fotoUrl: estudiante.fotoUrl,
          estadoValidacion: estudiante.estadoValidacion as EstadoValidacion,
          cursos: estudiante.inscripciones.map((i) => i.curso.nombre),
        }
      : undefined,
    efectoEnSesion,
  };
  res.json(body);
});

/** Últimas verificaciones: el docente ve las suyas; el directivo, las de todos. */
verificacionesRouter.get('/', async (req, res) => {
  const lista = await prisma.verificacionIdentidad.findMany({
    where: req.staff!.rol === 'DIRECTIVO' ? {} : { verificadorId: req.staff!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { verificador: true, estudiante: { include: { usuario: true } } },
  });
  res.json(
    lista.map(
      (v): VerificacionResumen => ({
        id: v.id,
        resultado: v.resultado as VerificacionResumen['resultado'],
        motivo: v.motivo,
        fecha: v.createdAt.toISOString(),
        verificador: `${v.verificador.nombre} ${v.verificador.apellido}`,
        estudiante: v.estudiante ? `${v.estudiante.usuario.nombre} ${v.estudiante.usuario.apellido} (DNI ${v.estudiante.dni})` : null,
      }),
    ),
  );
});
