// Log de auditoría para directivos: une la tabla Auditoria (correcciones, dispositivos,
// validaciones, sesiones) con las verificaciones de identidad, que tienen su propia tabla.
import { Router } from 'express';
import { ACCIONES_AUDITORIA, CATEGORIAS_AUDITORIA, type CategoriaAuditoria, type EntradaAuditoria } from '@presente/shared';
import { prisma } from '../../lib/prisma';
import { authStaff } from '../../middleware/authStaff';

export const auditoriaRouter = Router();
auditoriaRouter.use(authStaff('DIRECTIVO'));

const LIMITE = 200;

/** Arma un texto legible con los datos útiles del JSON de detalle. */
function resumir(detalle: Record<string, unknown>, nombres: Map<string, string>): string {
  const partes: string[] = [];
  const est = (detalle.estudianteId ?? detalle.usuarioId) as string | undefined;
  if (est && nombres.has(est)) partes.push(nombres.get(est)!);
  if (detalle.dni) partes.push(`DNI ${detalle.dni}`);
  if (detalle.curso) partes.push(String(detalle.curso));
  if (detalle.offsetMin !== undefined) partes.push(`reloj ${Number(detalle.offsetMin) >= 0 ? '+' : ''}${detalle.offsetMin} min`);
  if (detalle.motivo) partes.push(`motivo: "${detalle.motivo}"`);
  return partes.join(' · ');
}

auditoriaRouter.get('/', async (req, res) => {
  const categoria = CATEGORIAS_AUDITORIA.includes(req.query.categoria as CategoriaAuditoria) ? (req.query.categoria as CategoriaAuditoria) : undefined;
  const acciones = categoria ? Object.entries(ACCIONES_AUDITORIA).filter(([, v]) => v.categoria === categoria).map(([k]) => k) : undefined;

  const [auditorias, verificaciones] = await Promise.all([
    categoria === 'VERIFICACIONES'
      ? []
      : prisma.auditoria.findMany({ where: acciones ? { accion: { in: acciones } } : {}, orderBy: { createdAt: 'desc' }, take: LIMITE, include: { actor: true } }),
    !categoria || categoria === 'VERIFICACIONES'
      ? prisma.verificacionIdentidad.findMany({
          orderBy: { createdAt: 'desc' },
          take: LIMITE,
          include: { verificador: true, estudiante: { include: { usuario: true } }, sesion: { include: { curso: true } } },
        })
      : [],
  ]);

  // Nombres de estudiantes/usuarios mencionados en los detalles (por id).
  const detalles = auditorias.map((a) => (a.detalle ? (JSON.parse(a.detalle) as Record<string, unknown>) : {}));
  const ids = new Set(detalles.flatMap((d) => [d.estudianteId, d.usuarioId]).filter((x): x is string => typeof x === 'string'));
  const [estudiantes, usuarios] = await Promise.all([
    prisma.estudiante.findMany({ where: { id: { in: [...ids] } }, include: { usuario: true } }),
    prisma.usuario.findMany({ where: { id: { in: [...ids] } } }),
  ]);
  const nombres = new Map<string, string>([
    ...estudiantes.map((e) => [e.id, `${e.usuario.nombre} ${e.usuario.apellido}`] as [string, string]),
    ...usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`] as [string, string]),
  ]);
  const nombreActor = (u: { nombre: string; apellido: string } | null) => (u ? `${u.nombre} ${u.apellido}` : null);

  const entradas: EntradaAuditoria[] = [
    ...auditorias.map((a, i) => {
      const info = ACCIONES_AUDITORIA[a.accion] ?? { categoria: 'SESIONES' as const, etiqueta: a.accion };
      return { id: a.id, fecha: a.createdAt.toISOString(), categoria: info.categoria, accion: a.accion, etiqueta: info.etiqueta, actor: nombreActor(a.actor), resumen: resumir(detalles[i], nombres) };
    }),
    ...verificaciones.map((v) => ({
      id: v.id,
      fecha: v.createdAt.toISOString(),
      categoria: 'VERIFICACIONES' as const,
      accion: 'VERIFICACION_IDENTIDAD',
      etiqueta: `Verificación de identidad: ${v.resultado}`,
      actor: nombreActor(v.verificador),
      resumen: [
        v.estudiante ? `${v.estudiante.usuario.nombre} ${v.estudiante.usuario.apellido}` : 'QR no identificable',
        v.sesion && `en ${v.sesion.curso.nombre}`,
        v.motivo,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, LIMITE);

  res.json(entradas);
});
