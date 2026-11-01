// Reglas de presentismo (lógica pura, testeable sin base).
import type { EstadoSesion } from '@presente/shared';

interface SesionHorario {
  inicio: Date;
  fin: Date;
  toleranciaMin: number;
  abiertaAt: Date | null;
  cerradaAt: Date | null;
}

export function estadoSesion(s: Pick<SesionHorario, 'abiertaAt' | 'cerradaAt'>): EstadoSesion {
  if (s.cerradaAt) return 'CERRADA';
  return s.abiertaAt ? 'ABIERTA' : 'PROGRAMADA';
}

export type Evaluacion = { acepta: true } | { acepta: false; codigo: 'SESION_NO_ABIERTA' | 'SESION_CERRADA' | 'FUERA_DE_HORARIO'; mensaje: string };

/**
 * Una sesión acepta presentes por QR si el docente la abrió, no la cerró y
 * ahora ∈ [inicio − tolerancia, fin]. La tolerancia permite dar presente un rato antes.
 */
export function evaluarSesion(s: SesionHorario, ahora: Date): Evaluacion {
  const estado = estadoSesion(s);
  if (estado === 'PROGRAMADA') return { acepta: false, codigo: 'SESION_NO_ABIERTA', mensaje: 'El docente todavía no abrió la sesión' };
  if (estado === 'CERRADA') return { acepta: false, codigo: 'SESION_CERRADA', mensaje: 'La sesión ya fue cerrada' };
  const desde = new Date(s.inicio.getTime() - s.toleranciaMin * 60_000);
  if (ahora < desde) return { acepta: false, codigo: 'FUERA_DE_HORARIO', mensaje: 'Todavía no empezó el horario de la sesión' };
  if (ahora > s.fin) return { acepta: false, codigo: 'FUERA_DE_HORARIO', mensaje: 'Terminó el horario de la sesión' };
  return { acepta: true };
}
