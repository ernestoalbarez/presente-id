import { z } from 'zod';
import type { EstadoValidacion } from '../types';

export const registroSchema = z.object({
  dni: z.string().trim().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos'),
  sexo: z.enum(['M', 'F', 'X'], { message: 'Elegí el sexo que figura en el DNI' }),
  nroTramite: z.string().trim().regex(/^\d{11}$/, 'El número de trámite tiene 11 dígitos'),
  deviceId: z.string().min(8).max(100),
  /** Clave pública Ed25519 del dispositivo: 32 bytes en base64url (43 caracteres). */
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Clave pública inválida'),
  modelo: z.string().max(100).optional(),
});
export type RegistroRequest = z.infer<typeof registroSchema>;

export type EstadoRegistro = 'VALIDADO' | 'RECHAZADO' | 'EN_REVISION' | 'CAMBIO_DISPOSITIVO_PENDIENTE';

export interface RegistroResponse {
  estado: EstadoRegistro;
  motivo?: string;
  /** Token de sesión del dispositivo. No viene si la validación fue rechazada. */
  deviceToken?: string;
}

/**
 * Situación del teléfono que consulta, calculada por el servidor:
 * - ACTIVO: dispositivo vinculado, puede usar la credencial.
 * - EN_REVISION: la validación de identidad espera revisión manual.
 * - CAMBIO_PENDIENTE: ya hay otro teléfono activo; espera que un directivo apruebe el cambio.
 * - RECHAZADO: un directivo rechazó la validación en revisión.
 * - REVOCADO: el dispositivo fue revocado o la solicitud de cambio rechazada.
 */
export type SituacionDispositivo = 'ACTIVO' | 'EN_REVISION' | 'CAMBIO_PENDIENTE' | 'RECHAZADO' | 'REVOCADO';

export interface PerfilEstudiante {
  nombre: string;
  apellido: string;
  dni: string;
  legajo: string;
  carrera: string;
  fotoUrl: string;
  estadoValidacion: EstadoValidacion;
  situacion: SituacionDispositivo;
  motivo?: string;
}
