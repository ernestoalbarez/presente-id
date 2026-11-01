import { Link } from 'react-router';
import type { SesionResumen } from '@presente/shared';
import { BadgeEstado, fecha, hora } from './ui';

/** Tabla de sesiones con link a la pantalla "en vivo". */
export function ListaSesiones({ sesiones, mostrarCurso = true }: { sesiones: SesionResumen[]; mostrarCurso?: boolean }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200 text-slate-500">
        <tr>
          <th className="px-5 py-3 font-medium">Fecha</th>
          {mostrarCurso && <th className="px-5 py-3 font-medium">Curso</th>}
          <th className="px-5 py-3 font-medium">Tipo</th>
          <th className="px-5 py-3 font-medium">Aula</th>
          <th className="px-5 py-3 font-medium">Presentes</th>
          <th className="px-5 py-3 font-medium">Estado</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {sesiones.map((s) => (
          <tr key={s.id} className="border-b border-slate-100 last:border-0">
            <td className="px-5 py-3">
              {fecha(s.inicio)} {hora(s.inicio)}–{hora(s.fin)}
            </td>
            {mostrarCurso && <td className="px-5 py-3">{s.curso}</td>}
            <td className="px-5 py-3">{s.tipo === 'EXAMEN' ? <span className="font-semibold text-amber-700">Examen</span> : 'Clase'}</td>
            <td className="px-5 py-3">{s.aula}</td>
            <td className="px-5 py-3">
              {s.presentes}/{s.inscriptos}
            </td>
            <td className="px-5 py-3">
              <BadgeEstado estado={s.estado} />
            </td>
            <td className="px-5 py-3 text-right">
              <Link to={`/sesiones/${s.id}`} className="font-medium text-indigo-700 hover:underline">
                Abrir →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
