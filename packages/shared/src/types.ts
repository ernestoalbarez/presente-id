// SQLite + Prisma: los "enums" se guardan como String. Acá está la lista cerrada de valores
// válidos; se usa para tipar el código y validar con zod.

export const ROLES = ['ESTUDIANTE', 'DOCENTE', 'DIRECTIVO'] as const;
export type Rol = (typeof ROLES)[number];
export type RolStaff = Exclude<Rol, 'ESTUDIANTE'>;

export const ESTADOS_USUARIO = ['ACTIVO', 'INACTIVO'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export const ESTADOS_VALIDACION = ['PENDIENTE', 'VALIDADO', 'RECHAZADO', 'EN_REVISION'] as const;
export type EstadoValidacion = (typeof ESTADOS_VALIDACION)[number];

export const RESULTADOS_RENAPER = ['APROBADO', 'RECHAZADO', 'EN_REVISION'] as const;
export type ResultadoRenaper = (typeof RESULTADOS_RENAPER)[number];

export const ESTADOS_DISPOSITIVO = ['PENDIENTE', 'ACTIVO', 'REVOCADO'] as const;
export type EstadoDispositivo = (typeof ESTADOS_DISPOSITIVO)[number];

export const ESTADOS_SOLICITUD = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const MODOS_PUNTO_ACCESO = ['ESTATICO', 'ROTATIVO'] as const;
export type ModoPuntoAcceso = (typeof MODOS_PUNTO_ACCESO)[number];

export const TIPOS_SESION = ['CLASE', 'EXAMEN'] as const;
export type TipoSesion = (typeof TIPOS_SESION)[number];

export const METODOS_ASISTENCIA = ['QR', 'MANUAL'] as const;
export type MetodoAsistencia = (typeof METODOS_ASISTENCIA)[number];

export const TIPOS_INGRESO = ['INGRESO', 'EGRESO'] as const;
export type TipoIngreso = (typeof TIPOS_INGRESO)[number];

export const RESULTADOS_VERIFICACION = ['VALIDO', 'VENCIDO', 'INVALIDO', 'DISPOSITIVO_REVOCADO'] as const;
export type ResultadoVerificacion = (typeof RESULTADOS_VERIFICACION)[number];

/** Usuario de backoffice tal como lo devuelve la API. */
export interface UsuarioStaff {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: RolStaff;
}
