import { useState } from 'react';
import { CATEGORIAS_AUDITORIA, type CategoriaAuditoria, type EntradaAuditoria } from '@presente/shared';
import { usePolling } from '../api/usePolling';
import { fechaHora, Tarjeta, Titulo, Vacio } from '../components/ui';

const NOMBRE: Record<CategoriaAuditoria, string> = {
  VERIFICACIONES: 'Verificaciones',
  ASISTENCIA: 'Correcciones de asistencia',
  DISPOSITIVOS: 'Dispositivos',
  VALIDACIONES: 'Validaciones',
  SESIONES: 'Sesiones y puertas',
  DEMO: 'Modo demo',
};

const COLOR: Record<CategoriaAuditoria, string> = {
  VERIFICACIONES: 'bg-indigo-100 text-indigo-800',
  ASISTENCIA: 'bg-amber-100 text-amber-800',
  DISPOSITIVOS: 'bg-sky-100 text-sky-800',
  VALIDACIONES: 'bg-green-100 text-green-800',
  SESIONES: 'bg-slate-100 text-slate-700',
  DEMO: 'bg-pink-100 text-pink-800',
};

/** Log de verificaciones, correcciones manuales, cambios de dispositivo y demás acciones sensibles. */
export function AuditoriaPage() {
  const [categoria, setCategoria] = useState<CategoriaAuditoria | ''>('');
  const { data } = usePolling<EntradaAuditoria[]>(`/auditoria${categoria ? `?categoria=${categoria}` : ''}`);

  const chip = (valor: CategoriaAuditoria | '', texto: string) => (
    <button
      key={valor || 'todo'}
      onClick={() => setCategoria(valor)}
      className={`rounded-full px-3 py-1 text-sm ${categoria === valor ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      {texto}
    </button>
  );

  return (
    <div>
      <Titulo sub="Últimas 200 acciones. Se actualiza cada 3 s.">Auditoría</Titulo>
      <div className="mb-4 flex flex-wrap gap-2">
        {chip('', 'Todo')}
        {CATEGORIAS_AUDITORIA.map((c) => chip(c, NOMBRE[c]))}
      </div>
      {data?.length === 0 && <Vacio>No hay registros.</Vacio>}
      {!!data?.length && (
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Acción</th>
                <th className="px-5 py-3 font-medium">Quién</th>
                <th className="px-5 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">{fechaHora(e.fecha)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${COLOR[e.categoria]}`}>{e.etiqueta}</span>
                  </td>
                  <td className="px-5 py-2.5">{e.actor ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-2.5 text-slate-600">{e.resumen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </div>
  );
}
