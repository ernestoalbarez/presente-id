// Ingreso a sede: el directivo genera QRs por puerta (estáticos para imprimir o rotativos en
// una pantalla) y el estudiante los escanea con la app al entrar o salir.
import { Router } from 'express';
import { errors as joseErrors } from 'jose';
import {
  crearPuntoAccesoSchema,
  escaneoSchema,
  ROTACION_QR_ASISTENCIA_S,
  TYP_QR_PUERTA,
  type IngresoResponse,
  type ModoPuntoAcceso,
  type QrPuertaResponse,
  type SedeConPuntos,
  type TipoIngreso,
} from '@presente/shared';
import { auditar } from '../../lib/audit';
import { clock } from '../../lib/clock';
import { verificarEscaneoFirmado, VENTANA_ESCANEO_S } from '../../lib/escaneoFirmado';
import { HttpError, parse } from '../../lib/errors';
import { consumirNonce } from '../../lib/nonces';
import { prisma } from '../../lib/prisma';
import { firmarToken, verificarToken } from '../../lib/tokens';
import { authDevice } from '../../middleware/authDevice';
import { authStaff } from '../../middleware/authStaff';
import { rangoDelDia } from '../sesiones/service';

/** QR impreso: vale un año (no rota). Ver limitaciones en el README. */
const VIDA_QR_ESTATICO_S = 365 * 24 * 3600;
/** QR en pantalla: misma lógica que el de asistencia (rota cada 15 s, vale 30 s). */
const VIDA_QR_ROTATIVO_S = ROTACION_QR_ASISTENCIA_S * 2;
/** Evita que un doble escaneo accidental registre ingreso y egreso seguidos. */
const MIN_ENTRE_EVENTOS_S = 60;

// Montado en "/": la auth va por ruta (un router.use() acá afectaría a cualquier URL que llegue).
export const puertasRouter = Router();
const soloDirectivo = authStaff('DIRECTIVO');

puertasRouter.get('/sedes', soloDirectivo, async (_req, res) => {
  const sedes = await prisma.sede.findMany({ orderBy: { nombre: 'asc' }, include: { puntosAcceso: { orderBy: { nombre: 'asc' } } } });
  res.json(
    sedes.map(
      (s): SedeConPuntos => ({
        id: s.id,
        nombre: s.nombre,
        direccion: s.direccion,
        puntos: s.puntosAcceso.map((p) => ({ id: p.id, nombre: p.nombre, modo: p.modo as ModoPuntoAcceso, activo: p.activo })),
      }),
    ),
  );
});

puertasRouter.post('/puntos-acceso', soloDirectivo, async (req, res) => {
  const datos = parse(crearPuntoAccesoSchema, req.body);
  const punto = await prisma.puntoAcceso.create({ data: datos });
  await auditar({ actorId: req.staff!.id, accion: 'PUNTO_ACCESO_CREADO', entidad: 'PuntoAcceso', entidadId: punto.id, detalle: datos });
  res.status(201).json({ id: punto.id });
});

puertasRouter.get('/puntos-acceso/:id/qr', soloDirectivo, async (req, res) => {
  const punto = await prisma.puntoAcceso.findUnique({ where: { id: String(req.params.id) }, include: { sede: true } });
  if (!punto || !punto.activo) throw new HttpError(404, 'Punto de acceso inexistente o inactivo', 'NO_ENCONTRADO');
  const rotativo = punto.modo === 'ROTATIVO';
  const qr = await firmarToken(TYP_QR_PUERTA, { pid: punto.id }, rotativo ? VIDA_QR_ROTATIVO_S : VIDA_QR_ESTATICO_S);
  const body: QrPuertaResponse = {
    qr,
    modo: punto.modo as ModoPuntoAcceso,
    rotaEnSeg: rotativo ? ROTACION_QR_ASISTENCIA_S : undefined,
    sede: punto.sede.nombre,
    punto: punto.nombre,
  };
  res.json(body);
});

export const ingresosRouter = Router();

/**
 * Escaneo de una puerta desde la app. El tipo se alterna solo: si el último evento del día
 * fue un INGRESO, este es un EGRESO, y viceversa.
 */
ingresosRouter.post('/escaneo', authDevice(), async (req, res) => {
  const { dispositivo, estudiante } = req.sesionDispositivo!;
  const { jws } = parse(escaneoSchema, req.body);

  const escaneo = verificarEscaneoFirmado(jws, dispositivo, clock.nowSeconds());
  if (!escaneo.ok) throw new HttpError(400, escaneo.motivo, 'ESCANEO_INVALIDO');
  if (!(await consumirNonce(escaneo.payload.nonce, escaneo.payload.ts + VENTANA_ESCANEO_S))) {
    throw new HttpError(409, 'Este escaneo ya fue procesado', 'ESCANEO_REPETIDO');
  }

  let pid: string;
  try {
    ({ pid } = await verificarToken<{ pid: string }>(TYP_QR_PUERTA, escaneo.payload.qr));
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) throw new HttpError(400, 'El QR de la puerta ya rotó. Escaneá el actual.', 'QR_VENCIDO');
    throw new HttpError(400, 'El código escaneado no es un QR de ingreso válido', 'QR_INVALIDO');
  }
  const punto = await prisma.puntoAcceso.findUnique({ where: { id: pid }, include: { sede: true } });
  if (!punto || !punto.activo) throw new HttpError(404, 'Punto de acceso inexistente o inactivo', 'NO_ENCONTRADO');

  const ahora = clock.now();
  const ultimo = await prisma.eventoIngreso.findFirst({
    where: { estudianteId: estudiante.id, timestamp: rangoDelDia() },
    orderBy: { timestamp: 'desc' },
  });
  if (ultimo && ultimo.puntoAccesoId === punto.id && ahora.getTime() - ultimo.timestamp.getTime() < MIN_ENTRE_EVENTOS_S * 1000) {
    throw new HttpError(409, 'Ya registraste este acceso hace un momento', 'INGRESO_REPETIDO');
  }
  const tipo: TipoIngreso = ultimo?.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO';
  const evento = await prisma.eventoIngreso.create({ data: { estudianteId: estudiante.id, puntoAccesoId: punto.id, tipo, timestamp: ahora } });

  const body: IngresoResponse = { tipo, sede: punto.sede.nombre, punto: punto.nombre, timestamp: evento.timestamp.toISOString() };
  res.status(201).json(body);
});
