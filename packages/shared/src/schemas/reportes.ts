import { z } from 'zod';
import { MODOS_PUNTO_ACCESO, type MetodoAsistencia, type ModoPuntoAcceso, type TipoIngreso, type TipoSesion } from '../types';

// --- Constancias -------------------------------------------------------------

/** Datos públicos que firma el servidor (sin DNI ni legajo). */
export interface PayloadConstancia {
  v: 1;
  codigo: string;
  tipo: TipoSesion;
  curso: string;
  sede: string;
  aula: string;
  fecha: string; // inicio de la sesión (ISO)
  titular: string; // "Camila F."
  emitida: string; // ISO
}

export interface ConstanciaApp extends PayloadConstancia {
  hash: string;
  revocada: boolean;
  /** Link público de verificación (página del backoffice). */
  urlVerificacion: string;
}

export interface VerificacionPublicaConstancia {
  codigo: string;
  /** La firma del servidor es válida y coincide con lo guardado. */
  autentica: boolean;
  revocada: boolean;
  constancia?: Omit<PayloadConstancia, 'v' | 'codigo'>;
  hash?: string;
}

// --- Ingresos ----------------------------------------------------------------

export const crearPuntoAccesoSchema = z.object({
  sedeId: z.string().min(1),
  nombre: z.string().trim().min(1, 'Indicá un nombre').max(60),
  modo: z.enum(MODOS_PUNTO_ACCESO),
});

export interface PuntoAccesoInfo {
  id: string;
  nombre: string;
  modo: ModoPuntoAcceso;
  activo: boolean;
}

export interface SedeConPuntos {
  id: string;
  nombre: string;
  direccion: string;
  puntos: PuntoAccesoInfo[];
}

export interface QrPuertaResponse {
  qr: string;
  modo: ModoPuntoAcceso;
  /** Solo para puertas rotativas. */
  rotaEnSeg?: number;
  sede: string;
  punto: string;
}

export interface IngresoResponse {
  tipo: TipoIngreso;
  sede: string;
  punto: string;
  timestamp: string;
}

export interface ReporteIngresos {
  fecha: string;
  porSede: Array<{ sede: string; ingresos: number; egresos: number; estudiantes: number }>;
  porFranja: Array<{ hora: number; ingresos: number }>;
  eventos: Array<{ id: string; tipo: TipoIngreso; timestamp: string; sede: string; punto: string; estudiante: string; legajo: string }>;
}

// --- Historial de la app -----------------------------------------------------

export interface HistorialApp {
  asistencias: Array<{ id: string; curso: string; tipo: TipoSesion; fecha: string; metodo: MetodoAsistencia; verificadaPresencialmente: boolean }>;
  ingresos: Array<{ id: string; tipo: TipoIngreso; sede: string; punto: string; timestamp: string }>;
}

// --- Reportes del backoffice -------------------------------------------------

export interface Dashboard {
  sesionesHoy: number;
  presentesHoy: number;
  esperadosHoy: number; // suma de inscriptos de las sesiones de hoy
  asistenciaSemanaPct: number | null; // sesiones cerradas de los últimos 7 días
  ingresosHoy: number | null; // solo directivos
  validacionesPendientes: number | null; // solo directivos
  solicitudesPendientes: number | null; // solo directivos
}

export interface GrillaAsistencia {
  curso: string;
  sesiones: Array<{ id: string; inicio: string; tipo: TipoSesion }>;
  filas: Array<{
    estudianteId: string;
    apellido: string;
    nombre: string;
    legajo: string;
    celdas: Record<string, MetodoAsistencia | null>;
    porcentaje: number | null;
  }>;
}
