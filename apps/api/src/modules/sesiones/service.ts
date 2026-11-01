// Consultas y control de acceso compartidos por las rutas de cursos y sesiones.
import type { Prisma } from '@prisma/client';
import type { MetodoAsistencia, SesionDetalle, SesionResumen, TipoSesion, UsuarioStaff } from '@presente/shared';
import { clock } from '../../lib/clock';
import { HttpError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { estadoSesion, evaluarSesion } from './reglas';

/** Filtro de cursos visibles: el docente ve los suyos; el directivo, todos. */
export const cursosVisibles = (staff: UsuarioStaff): Prisma.CursoWhereInput =>
  staff.rol === 'DIRECTIVO' ? {} : { docenteId: staff.id };

export async function cursoConAcceso(staff: UsuarioStaff, cursoId: string) {
  const curso = await prisma.curso.findFirst({ where: { id: cursoId, ...cursosVisibles(staff) } });
  if (!curso) throw new HttpError(404, 'Curso inexistente o sin acceso', 'NO_ENCONTRADO');
  return curso;
}

export async function sesionConAcceso(staff: UsuarioStaff, sesionId: string) {
  const sesion = await prisma.sesion.findFirst({ where: { id: sesionId, curso: cursosVisibles(staff) }, include: { curso: true } });
  if (!sesion) throw new HttpError(404, 'Sesión inexistente o sin acceso', 'NO_ENCONTRADO');
  return sesion;
}

const includeResumen = {
  curso: { include: { _count: { select: { inscripciones: true } } } },
  _count: { select: { asistencias: true } },
} satisfies Prisma.SesionInclude;

type SesionConConteos = Prisma.SesionGetPayload<{ include: typeof includeResumen }>;

function aResumen(s: SesionConConteos): SesionResumen {
  return {
    id: s.id,
    cursoId: s.cursoId,
    curso: s.curso.nombre,
    tipo: s.tipo as TipoSesion,
    inicio: s.inicio.toISOString(),
    fin: s.fin.toISOString(),
    aula: s.aula,
    toleranciaMin: s.toleranciaMin,
    requiereVerificacionIdentidad: s.requiereVerificacionIdentidad,
    estado: estadoSesion(s),
    presentes: s._count.asistencias,
    inscriptos: s.curso._count.inscripciones,
  };
}

export async function listarSesiones(where: Prisma.SesionWhereInput): Promise<SesionResumen[]> {
  const sesiones = await prisma.sesion.findMany({ where, include: includeResumen, orderBy: { inicio: 'asc' } });
  return sesiones.map(aResumen);
}

/** Sesión con la lista completa de inscriptos y su presente (la pantalla "en vivo" la consulta cada 3 s). */
export async function detalleSesion(sesionId: string): Promise<SesionDetalle> {
  const s = await prisma.sesion.findUniqueOrThrow({ where: { id: sesionId }, include: includeResumen });
  const [inscripciones, asistencias] = await Promise.all([
    prisma.inscripcion.findMany({ where: { cursoId: s.cursoId }, include: { estudiante: { include: { usuario: true } } } }),
    prisma.asistencia.findMany({ where: { sesionId } }),
  ]);
  const evaluacion = evaluarSesion(s, clock.now());
  return {
    ...aResumen(s),
    aceptaPresentes: evaluacion.acepta,
    motivoNoAcepta: evaluacion.acepta ? undefined : evaluacion.mensaje,
    asistencias: inscripciones
      .map(({ estudiante: e }) => {
        const a = asistencias.find((x) => x.estudianteId === e.id);
        return {
          estudianteId: e.id,
          nombre: e.usuario.nombre,
          apellido: e.usuario.apellido,
          legajo: e.legajo,
          fotoUrl: e.fotoUrl,
          asistencia: a
            ? { timestamp: a.timestamp.toISOString(), metodo: a.metodo as MetodoAsistencia, verificadaPresencialmente: a.verificadaPresencialmente }
            : null,
        };
      })
      .sort((x, y) => x.apellido.localeCompare(y.apellido)),
  };
}

/** Límites [desde, hasta) del día local de `fecha` (YYYY-MM-DD) o de hoy según el reloj del servidor. */
export function rangoDelDia(fecha?: string): { gte: Date; lt: Date } {
  const base = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00`) : clock.now();
  const gte = new Date(base);
  gte.setHours(0, 0, 0, 0);
  const lt = new Date(gte);
  lt.setDate(lt.getDate() + 1);
  return { gte, lt };
}
