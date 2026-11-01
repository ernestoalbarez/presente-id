import { z } from 'zod';
import type { EstadoValidacion, ResultadoVerificacion } from '../types';

export const verificarIdentidadSchema = z.object({
  qr: z.string().trim().min(1, 'El QR está vacío').max(2000),
});

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
}

export interface VerificacionResumen {
  id: string;
  resultado: ResultadoVerificacion;
  motivo: string | null;
  fecha: string;
  verificador: string;
  estudiante: string | null;
}
