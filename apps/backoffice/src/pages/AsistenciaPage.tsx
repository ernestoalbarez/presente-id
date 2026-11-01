import { useEffect, useState } from 'react';
import type { GrillaAsistencia } from '@presente/shared';
import { api, descargar } from '../api/client';
import { usePolling } from '../api/usePolling';
import { Boton, Tarjeta, Titulo } from '../components/ui';

/** Grilla estudiante × sesión de un curso, con exportación a CSV. */
export function AsistenciaPage() {
  const cursos = usePolling<Array<{ id: string; nombre: string; codigo: string }>>('/cursos');
  const [cursoId, setCursoId] = useState('');
  const [grilla, setGrilla] = useState<GrillaAsistencia | null>(null);

  useEffect(() => {
    if (!cursoId && cursos.data?.length) setCursoId(cursos.data[0].id);
  }, [cursos.data, cursoId]);

  useEffect(() => {
    if (!cursoId) return;
    setGrilla(null);
    void api<GrillaAsistencia>(`/reportes/asistencia?cursoId=${cursoId}`).then(setGrilla);
  }, [cursoId]);

  const exportar = () => {
    const codigo = cursos.data?.find((c) => c.id === cursoId)?.codigo ?? 'curso';
    descargar(`/reportes/asistencia?cursoId=${cursoId}&formato=csv`, `asistencia-${codigo}.csv`).catch((e) => alert(e.message));
  };

  return (
    <div>
      <Titulo sub="P = presente por QR · M = cargado a mano · vacío = ausente. Solo sesiones ya empezadas.">Asistencia</Titulo>
      <div className="mb-4 flex items-center gap-3">
        <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {cursos.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <Boton variante="secundario" onClick={exportar} disabled={!grilla}>
          Exportar CSV
        </Boton>
      </div>
      {grilla && (
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">Estudiante</th>
                {grilla.sesiones.map((s) => (
                  <th key={s.id} className="px-2 py-3 text-center font-medium whitespace-nowrap">
                    {new Date(s.inicio).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    {s.tipo === 'EXAMEN' && <span className="block text-xs text-amber-700">examen</span>}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {grilla.filas.map((f) => (
                <tr key={f.estudianteId} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 bg-white px-4 py-2 whitespace-nowrap">
                    {f.apellido}, {f.nombre} <span className="text-slate-400">{f.legajo}</span>
                  </td>
                  {grilla.sesiones.map((s) => {
                    const v = f.celdas[s.id];
                    return (
                      <td key={s.id} className="px-2 py-2 text-center">
                        {v === 'QR' && <span className="rounded bg-green-100 px-1.5 font-semibold text-green-800">P</span>}
                        {v === 'MANUAL' && <span className="rounded bg-indigo-100 px-1.5 font-semibold text-indigo-800">M</span>}
                      </td>
                    );
                  })}
                  <td className={`px-4 py-2 text-right font-semibold ${f.porcentaje !== null && f.porcentaje < 75 ? 'text-red-600' : ''}`}>
                    {f.porcentaje === null ? '—' : `${f.porcentaje}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </div>
  );
}
