// Presente desde la app: el estudiante escanea el QR proyectado y el teléfono envía el token
// del QR envuelto en un JWS firmado con su clave privada.
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { errors as joseErrors } from 'jose';
import { escaneoSchema, TYP_QR_ASISTENCIA, type PresenteResponse, type TipoSesion } from '@presente/shared';
import { clock } from '../../lib/clock';
import { verificarEscaneoFirmado, VENTANA_ESCANEO_S } from '../../lib/escaneoFirmado';
import { HttpError, parse } from '../../lib/errors';
import { consumirNonce } from '../../lib/nonces';
import { prisma } from '../../lib/prisma';
import { verificarToken } from '../../lib/tokens';
import { authDevice } from '../../middleware/authDevice';
import { evaluarSesion } from '../sesiones/reglas';

export const asistenciasRouter = Router();

asistenciasRouter.post('/escaneo', authDevice(), async (req, res) => {
  const { dispositivo, estudiante } = req.sesionDispositivo!;
  const { jws } = parse(escaneoSchema, req.body);

  // 1. Firma del dispositivo: el escaneo lo hizo el teléfono vinculado (authDevice ya exigió que esté ACTIVO).
  const escaneo = verificarEscaneoFirmado(jws, dispositivo, clock.nowSeconds());
  if (!escaneo.ok) throw new HttpError(400, escaneo.motivo, 'ESCANEO_INVALIDO');
  // 2. Antirreplay: el mismo escaneo firmado no se puede reenviar.
  if (!(await consumirNonce(escaneo.payload.nonce, escaneo.payload.ts + VENTANA_ESCANEO_S))) {
    throw new HttpError(409, 'Este escaneo ya fue procesado', 'ESCANEO_REPETIDO');
  }

  // 3. Token del QR: firmado por el servidor, de asistencia y vigente (rota cada 15 s).
  let sid: string;
  try {
    ({ sid } = await verificarToken<{ sid: string }>(TYP_QR_ASISTENCIA, escaneo.payload.qr));
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) throw new HttpError(400, 'El QR ya rotó. Escaneá el que está proyectado ahora.', 'QR_VENCIDO');
    throw new HttpError(400, 'El código escaneado no es un QR de asistencia válido', 'QR_INVALIDO');
  }

  // 4. Sesión abierta y dentro del horario.
  const sesion = await prisma.sesion.findUnique({ where: { id: sid }, include: { curso: true } });
  if (!sesion) throw new HttpError(404, 'La sesión no existe', 'NO_ENCONTRADO');
  const evaluacion = evaluarSesion(sesion, clock.now());
  if (!evaluacion.acepta) throw new HttpError(409, evaluacion.mensaje, evaluacion.codigo);

  // 5. Inscripto en el curso.
  const inscripto = await prisma.inscripcion.findUnique({ where: { estudianteId_cursoId: { estudianteId: estudiante.id, cursoId: sesion.cursoId } } });
  if (!inscripto) throw new HttpError(403, `No estás inscripto en ${sesion.curso.nombre}`, 'NO_INSCRIPTO_CURSO');

  // 6. Sin duplicados: la restricción única (estudiante, sesión) lo garantiza.
  try {
    const asistencia = await prisma.asistencia.create({
      data: { estudianteId: estudiante.id, sesionId: sesion.id, metodo: 'QR', timestamp: clock.now() },
    });
    const body: PresenteResponse = {
      asistenciaId: asistencia.id,
      curso: sesion.curso.nombre,
      tipo: sesion.tipo as TipoSesion,
      aula: sesion.aula,
      timestamp: asistencia.timestamp.toISOString(),
      requiereVerificacionIdentidad: sesion.requiereVerificacionIdentidad,
    };
    res.status(201).json(body);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, `Ya tenés el presente en ${sesion.curso.nombre}`, 'YA_PRESENTE');
    }
    throw e;
  }
});
