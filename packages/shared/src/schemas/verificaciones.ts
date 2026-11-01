import { z } from 'zod';
import type { EstadoValidacion, ResultadoVerificacion } from '../types';

export const verificarIdentidadSchema = z.object({
  qr: z.string().trim().min(1, 'El QR está vacío').max(2000),
  /** Si se verifica dentro de una sesión (examen), marca el presente como verificado presencialmente. */
  sesionId: z.string().optional(),
});

/** Efecto de la verificación sobre el presente de la sesión indicada. */
export type EfectoEnSesion = 'VERIFICADA' | 'SIN_PRESENTE' | 'NO_INSCRIPTO';

export interface EstudianteVerificado {
  nombre: string;
  apellido: string;
  dni: string;
  legajo: string;
  carrera: string;
  fotoUrl: string;
  estadoValidacion: EstadoValidacion;
  cursos: string[];
}

export interface VerificacionIdentidadResponse {
  id: string;
  resultado: ResultadoVerificacion;
  motivo?: string;
  fecha: string;
  /** Solo si la firma del QR es auténtica. */
  estudiante?: EstudianteVerificado;
  /** Solo si se pidió con `sesionId` y el resultado fue VALIDO. */
  efectoEnSesion?: EfectoEnSesion;
}

export interface VerificacionResumen {
  id: string;
  resultado: ResultadoVerificacion;
  motivo: string | null;
  fecha: string;
  verificador: string;
  estudiante: string | null;
}
