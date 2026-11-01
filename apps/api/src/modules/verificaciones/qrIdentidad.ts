// Validación del QR de identidad que muestra el estudiante. Es lógica pura: recibe sus
// dependencias (buscar dispositivo, consumir nonce, hora) para poder testearla sin base.
//
// Orden de los chequeos y por qué:
//  1. Formato y `typ`               → INVALIDO  (no es un QR de identidad de PresenteID)
//  2. Dispositivo existe            → INVALIDO
//  3. Firma con su clave pública    → INVALIDO  (falsificado o alterado)
//  4. `sub` = dueño del dispositivo → INVALIDO
//  5. Dispositivo revocado          → DISPOSITIVO_REVOCADO (identidad conocida, teléfono dado de baja)
//  6. Vigencia temporal             → VENCIDO   (p. ej. una captura de pantalla vieja)
//  7. Nonce de un solo uso          → INVALIDO  (el mismo QR ya se escaneó: reenvío/replay)
// A partir del paso 3 la firma es auténtica, así que se informa a quién pertenece el QR.
import { decodificarJws, base64url, TYP_QR_IDENTIDAD, ROTACION_QR_IDENTIDAD_S, type PayloadQrIdentidad, type ResultadoVerificacion } from '@presente/shared';

/** Segundos de tolerancia por diferencia de reloj y demora entre el escaneo y la verificación. */
export const TOLERANCIA_RELOJ_S = 5;

export interface DispositivoParaVerificar {
  id: string;
  usuarioId: string;
  publicKey: string;
  estado: string;
}

export interface DepsVerificacion {
  ahoraSeg: number;
  buscarDispositivo(deviceId: string): Promise<DispositivoParaVerificar | null>;
  /** Marca el nonce como usado; devuelve false si ya lo estaba. */
  consumirNonce(nonce: string, expiraSeg: number): Promise<boolean>;
}

export interface ResultadoQrIdentidad {
  resultado: ResultadoVerificacion;
  motivo?: string;
  /** Presente solo si la firma es auténtica (se sabe a quién pertenece el QR). */
  dispositivo?: DispositivoParaVerificar;
}

const esPayloadValido = (p: Partial<PayloadQrIdentidad>): p is PayloadQrIdentidad =>
  typeof p.sub === 'string' &&
  typeof p.did === 'string' &&
  typeof p.nonce === 'string' &&
  p.nonce.length >= 16 &&
  Number.isInteger(p.iat) &&
  Number.isInteger(p.exp);

export async function verificarQrIdentidad(qr: string, deps: DepsVerificacion): Promise<ResultadoQrIdentidad> {
  const invalido = (motivo: string, dispositivo?: DispositivoParaVerificar): ResultadoQrIdentidad => ({ resultado: 'INVALIDO', motivo, dispositivo });

  const jws = decodificarJws<Partial<PayloadQrIdentidad>>(qr);
  if (!jws || jws.header.typ !== TYP_QR_IDENTIDAD || !esPayloadValido(jws.payload)) {
    return invalido('El código no es un QR de identidad de PresenteID');
  }
  const p = jws.payload;

  const dispositivo = await deps.buscarDispositivo(p.did);
  if (!dispositivo) return invalido('El dispositivo no está registrado');
  if (!jws.verificar(base64url.decode(dispositivo.publicKey))) return invalido('La firma del QR no es válida');
  if (p.sub !== dispositivo.usuarioId) return invalido('El QR no corresponde al dueño del dispositivo');

  if (dispositivo.estado === 'REVOCADO') {
    return { resultado: 'DISPOSITIVO_REVOCADO', motivo: 'El teléfono que generó el QR fue desvinculado', dispositivo };
  }
  if (dispositivo.estado !== 'ACTIVO') return invalido('El dispositivo todavía no está activo', dispositivo);

  // El teléfono firma su propio QR: además de `exp`, limitamos la vida máxima a 30 s para que
  // no pueda emitir un QR "eterno", y rechazamos fechas de emisión en el futuro.
  if (p.exp - p.iat > ROTACION_QR_IDENTIDAD_S || p.iat > deps.ahoraSeg + TOLERANCIA_RELOJ_S) {
    return invalido('El QR tiene una vigencia inválida', dispositivo);
  }
  if (deps.ahoraSeg > p.exp + TOLERANCIA_RELOJ_S) {
    return { resultado: 'VENCIDO', motivo: `El QR venció hace ${deps.ahoraSeg - p.exp} s`, dispositivo };
  }

  if (!(await deps.consumirNonce(p.nonce, p.exp + TOLERANCIA_RELOJ_S))) {
    return invalido('Este QR ya fue escaneado (posible reenvío)', dispositivo);
  }
  return { resultado: 'VALIDO', dispositivo };
}
