import { z } from 'zod';
import { TIPOS_SESION, type MetodoAsistencia, type TipoSesion } from '../types';

export const crearSesionSchema = z
  .object({
    tipo: z.enum(TIPOS_SESION),
    inicio: z.coerce.date({ message: 'Fecha de inicio inválida' }),
    fin: z.coerce.date({ message: 'Fecha de fin inválida' }),
    aula: z.string().trim().min(1, 'Indicá el aula').max(60),
    toleranciaMin: z.number().int().min(0).max(120).default(15),
    requiereVerificacionIdentidad: z.boolean().optional(),
  })
  .refine((s) => s.fin > s.inicio, { message: 'El fin tiene que ser posterior al inicio', path: ['fin'] });
export type CrearSesionRequest = z.input<typeof crearSesionSchema>;

export const correccionAsistenciaSchema = z.object({
  presente: z.boolean(),
  motivo: z.string().trim().min(3, 'Indicá el motivo de la corrección (queda auditado)').max(300),
});

export const escaneoSchema = z.object({ jws: z.string().min(1).max(4000) });

export type EstadoSesion = 'PROGRAMADA' | 'ABIERTA' | 'CERRADA';

export interface SesionResumen {
  id: string;
  cursoId: string;
  curso: string;
  tipo: TipoSesion;
  inicio: string;
  fin: string;
  aula: string;
  toleranciaMin: number;
  requiereVerificacionIdentidad: boolean;
  estado: EstadoSesion;
  presentes: number;
  inscriptos: number;
}

export interface AsistenciaItem {
  estudianteId: string;
  nombre: string;
  apellido: string;
  legajo: string;
  fotoUrl: string;
  asistencia: {
    timestamp: string;
    metodo: MetodoAsistencia;
    verificadaPresencialmente: boolean;
  } | null;
}

export interface SesionDetalle extends SesionResumen {
  /** Si hoy acepta presentes por QR y, si no, por qué. */
  aceptaPresentes: boolean;
  motivoNoAcepta?: string;
  asistencias: AsistenciaItem[];
}

export interface QrAsistenciaResponse {
  qr: string;
  /** Segundos hasta que el backoffice debería pedir uno nuevo. */
  rotaEnSeg: number;
}

/** Respuesta a la app cuando el presente se registró. */
export interface PresenteResponse {
  asistenciaId: string;
  curso: string;
  tipo: TipoSesion;
  aula: string;
  timestamp: string;
  requiereVerificacionIdentidad: boolean;
  /** Constancia de presencia emitida para este presente. */
  constancia: { codigo: string; urlVerificacion: string };
}
