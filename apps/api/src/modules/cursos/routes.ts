import { Router } from 'express';
import { crearSesionSchema } from '@presente/shared';
import { auditar } from '../../lib/audit';
import { parse } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { authStaff } from '../../middleware/authStaff';
import { cursoConAcceso, cursosVisibles, listarSesiones } from '../sesiones/service';

export const cursosRouter = Router();
cursosRouter.use(authStaff());

cursosRouter.get('/', async (req, res) => {
  const cursos = await prisma.curso.findMany({
    where: cursosVisibles(req.staff!),
    orderBy: { nombre: 'asc' },
    include: { sede: true, docente: true, _count: { select: { inscripciones: true, sesiones: true } } },
  });
  res.json(
    cursos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo,
      sede: c.sede.nombre,
      docente: `${c.docente.nombre} ${c.docente.apellido}`,
      inscriptos: c._count.inscripciones,
      sesiones: c._count.sesiones,
    })),
  );
});

cursosRouter.get('/:id', async (req, res) => {
  const curso = await cursoConAcceso(req.staff!, req.params.id);
  const [inscripciones, sesiones] = await Promise.all([
    prisma.inscripcion.findMany({ where: { cursoId: curso.id }, include: { estudiante: { include: { usuario: true } } } }),
    listarSesiones({ cursoId: curso.id }),
  ]);
  res.json({
    id: curso.id,
    nombre: curso.nombre,
    codigo: curso.codigo,
    inscriptos: inscripciones
      .map(({ estudiante: e }) => ({
        id: e.id,
        nombre: e.usuario.nombre,
        apellido: e.usuario.apellido,
        dni: e.dni,
        legajo: e.legajo,
        estadoValidacion: e.estadoValidacion,
      }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido)),
    sesiones,
  });
});

cursosRouter.post('/:id/sesiones', async (req, res) => {
  const curso = await cursoConAcceso(req.staff!, req.params.id);
  const datos = parse(crearSesionSchema, req.body);
  const sesion = await prisma.sesion.create({
    data: {
      cursoId: curso.id,
      tipo: datos.tipo,
      inicio: datos.inicio,
      fin: datos.fin,
      aula: datos.aula,
      toleranciaMin: datos.toleranciaMin,
      // Por defecto los exámenes exigen verificación de identidad cruzada.
      requiereVerificacionIdentidad: datos.requiereVerificacionIdentidad ?? datos.tipo === 'EXAMEN',
    },
  });
  await auditar({ actorId: req.staff!.id, accion: 'SESION_CREADA', entidad: 'Sesion', entidadId: sesion.id, detalle: { curso: curso.codigo, tipo: datos.tipo } });
  res.status(201).json({ id: sesion.id });
});
