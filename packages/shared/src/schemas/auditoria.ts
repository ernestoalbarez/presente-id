import { z } from 'zod';

/** Agrupación de las acciones auditadas para filtrar en el backoffice. */
export const CATEGORIAS_AUDITORIA = ['VERIFICACIONES', 'ASISTENCIA', 'DISPOSITIVOS', 'VALIDACIONES', 'SESIONES', 'DEMO'] as const;
export type CategoriaAuditoria = (typeof CATEGORIAS_AUDITORIA)[number];

/** Acción → categoría y texto legible. Las verificaciones de identidad vienen de su propia tabla. */
export const ACCIONES_AUDITORIA: Record<string, { categoria: CategoriaAuditoria; etiqueta: string }> = {
  VERIFICACION_IDENTIDAD: { categoria: 'VERIFICACIONES', etiqueta: 'Verificación de identidad' },
  ASISTENCIA_MARCADA_MANUAL: { categoria: 'ASISTENCIA', etiqueta: 'Presente cargado a mano' },
  ASISTENCIA_ANULADA_MANUAL: { categoria: 'ASISTENCIA', etiqueta: 'Presente anulado' },
  DISPOSITIVO_VINCULADO: { categoria: 'DISPOSITIVOS', etiqueta: 'Dispositivo vinculado' },
  SOLICITUD_CAMBIO_DISPOSITIVO: { categoria: 'DISPOSITIVOS', etiqueta: 'Solicitud de cambio de dispositivo' },
  CAMBIO_DISPOSITIVO_APROBADO: { categoria: 'DISPOSITIVOS', etiqueta: 'Cambio de dispositivo aprobado' },
  CAMBIO_DISPOSITIVO_RECHAZADO: { categoria: 'DISPOSITIVOS', etiqueta: 'Cambio de dispositivo rechazado' },
  DISPOSITIVO_REVOCADO: { categoria: 'DISPOSITIVOS', etiqueta: 'Dispositivo revocado' },
  VALIDACION_APROBADA: { categoria: 'VALIDACIONES', etiqueta: 'Validación aprobada en revisión' },
  VALIDACION_RECHAZADA: { categoria: 'VALIDACIONES', etiqueta: 'Validación rechazada en revisión' },
  SESION_CREADA: { categoria: 'SESIONES', etiqueta: 'Sesión creada' },
  SESION_ABIERTA: { categoria: 'SESIONES', etiqueta: 'Sesión abierta' },
  SESION_CERRADA: { categoria: 'SESIONES', etiqueta: 'Sesión cerrada' },
  PUNTO_ACCESO_CREADO: { categoria: 'SESIONES', etiqueta: 'Puerta creada' },
  DEMO_RELOJ: { categoria: 'DEMO', etiqueta: 'Demo: reloj movido' },
  DEMO_SESION_VENCIDA: { categoria: 'DEMO', etiqueta: 'Demo: sesión forzada a vencida' },
  DEMO_DISPOSITIVO_REVOCADO: { categoria: 'DEMO', etiqueta: 'Demo: dispositivo revocado' },
};

export interface EntradaAuditoria {
  id: string;
  fecha: string;
  categoria: CategoriaAuditoria;
  accion: string;
  etiqueta: string;
  actor: string | null;
  /** Resumen legible (estudiante, motivo, resultado…). */
  resumen: string;
}

export const demoRelojSchema = z.object({
  /** Desfase absoluto del reloj del servidor, en minutos (0 = hora real). */
  offsetMin: z.number().int().min(-60 * 24 * 30).max(60 * 24 * 30),
});

export interface EstadoDemo {
  demoMode: boolean;
  offsetMin: number;
  ahora: string;
}
