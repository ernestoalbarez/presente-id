// Constancias de presencia (inspiradas en POAP, sin blockchain): cada presente válido genera
// un registro con los datos públicos del evento firmado por el servidor (Ed25519). Cualquiera
// puede verificarla con el código público, sin acceder a datos sensibles.
import { createHash, randomInt } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { TYP_CONSTANCIA, type ConstanciaApp, type PayloadConstancia, type TipoSesion, type VerificacionPublicaConstancia } from '@presente/shared';
import { config } from '../../config';
import { firmarDocumento, verificarDocumento } from '../../lib/tokens';

type Db = PrismaClient | Prisma.TransactionClient;

// Sin caracteres ambiguos (0/O, 1/I/L) para que el código se pueda dictar o tipear.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const nuevoCodigo = () => {
  const c = Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
};

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const urlVerificacion = (codigo: string) => `${config.backofficePublicUrl}/verificar/${codigo}`;

/** Emite (firma y guarda) la constancia de una asistencia. */
export async function emitirConstancia(db: Db, asistenciaId: string) {
  const a = await db.asistencia.findUniqueOrThrow({
    where: { id: asistenciaId },
    include: { sesion: { include: { curso: { include: { sede: true } } } }, estudiante: { include: { usuario: true } } },
  });
  const codigo = nuevoCodigo();
  const payload: PayloadConstancia = {
    v: 1,
    codigo,
    tipo: a.sesion.tipo as TipoSesion,
    curso: a.sesion.curso.nombre,
    sede: a.sesion.curso.sede.nombre,
    aula: a.sesion.aula,
    fecha: a.sesion.inicio.toISOString(),
    titular: `${a.estudiante.usuario.nombre} ${a.estudiante.usuario.apellido.charAt(0)}.`,
    emitida: a.timestamp.toISOString(),
  };
  const contenido = JSON.stringify(payload);
  return db.constancia.create({
    data: {
      asistenciaId,
      estudianteId: a.estudianteId,
      codigo,
      payload: contenido,
      hash: sha256(contenido),
      firma: await firmarDocumento(TYP_CONSTANCIA, contenido),
      emitidaAt: a.timestamp,
    },
  });
}

/** Al anular un presente, su constancia queda revocada (no se borra: el link público lo informa). */
export async function revocarConstanciaDe(db: Db, asistenciaId: string) {
  await db.constancia.updateMany({ where: { asistenciaId }, data: { revocada: true } });
}

export function aConstanciaApp(c: { payload: string; hash: string; revocada: boolean; codigo: string }): ConstanciaApp {
  return { ...(JSON.parse(c.payload) as PayloadConstancia), hash: c.hash, revocada: c.revocada, urlVerificacion: urlVerificacion(c.codigo) };
}

/**
 * Verificación pública: la firma del servidor tiene que ser válida y el contenido firmado
 * tiene que coincidir con lo guardado (y con su hash). Si alguien edita la base a mano, falla.
 */
export async function verificarConstancia(db: Db, codigo: string): Promise<VerificacionPublicaConstancia> {
  const c = await db.constancia.findUnique({ where: { codigo: codigo.toUpperCase() } });
  if (!c) return { codigo, autentica: false, revocada: false };
  let autentica = false;
  try {
    const firmado = await verificarDocumento(TYP_CONSTANCIA, c.firma);
    autentica = firmado === c.payload && sha256(firmado) === c.hash;
  } catch {
    autentica = false;
  }
  if (!autentica) return { codigo: c.codigo, autentica: false, revocada: c.revocada };
  const { v: _v, codigo: _c, ...datos } = JSON.parse(c.payload) as PayloadConstancia;
  return { codigo: c.codigo, autentica: true, revocada: c.revocada, constancia: datos, hash: c.hash };
}
