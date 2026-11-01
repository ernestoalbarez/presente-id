import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { SesionResumen, TipoSesion } from '@presente/shared';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { ListaSesiones } from '../components/ListaSesiones';
import { Tarjeta, Titulo } from '../components/ui';

interface CursoDetalle {
  id: string;
  nombre: string;
  codigo: string;
  inscriptos: Array<{ id: string; nombre: string; apellido: string; dni: string; legajo: string; estadoValidacion: string }>;
  sesiones: SesionResumen[];
}

/** "YYYY-MM-DDTHH:mm" en hora local, para inputs datetime-local. */
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function CursoDetallePage() {
  const { id } = useParams();
  const { data, recargar } = usePolling<CursoDetalle>(`/cursos/${id}`);
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<TipoSesion>('CLASE');
  const [inicio, setInicio] = useState(() => local(new Date()));
  const [fin, setFin] = useState(() => local(new Date(Date.now() + 2 * 3_600_000)));
  const [aula, setAula] = useState('');
  const [toleranciaMin, setTolerancia] = useState(15);
  const [verificacion, setVerificacion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ id: string }>(`/cursos/${id}/sesiones`, {
        body: { tipo, inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString(), aula, toleranciaMin, requiereVerificacionIdentidad: verificacion },
      });
      await recargar();
      navigate(`/sesiones/${r.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!data) return <p className="text-slate-500">Cargando…</p>;
  const campo = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2';

  return (
    <div className="space-y-8">
      <Titulo sub={`${data.codigo} · ${data.inscriptos.length} inscriptos`}>{data.nombre}</Titulo>

      <div className="grid gap-6 xl:grid-cols-3">
        <Tarjeta className="overflow-x-auto p-0 xl:col-span-2">
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Sesiones</h2>
          <ListaSesiones sesiones={data.sesiones} mostrarCurso={false} />
        </Tarjeta>

        <Tarjeta>
          <h2 className="mb-3 font-semibold">Nueva sesión</h2>
          <form onSubmit={crear} className="space-y-3 text-sm">
            <label className="block">
              Tipo
              <select
                value={tipo}
                onChange={(e) => {
                  const t = e.target.value as TipoSesion;
                  setTipo(t);
                  setVerificacion(t === 'EXAMEN');
                }}
                className={campo}
              >
                <option value="CLASE">Clase</option>
                <option value="EXAMEN">Examen</option>
              </select>
            </label>
            <label className="block">
              Inicio
              <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} required />
            </label>
            <label className="block">
              Fin
              <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} className={campo} required />
            </label>
            <label className="block">
              Aula
              <input value={aula} onChange={(e) => setAula(e.target.value)} className={campo} required placeholder="Aula 12" />
            </label>
            <label className="block">
              Tolerancia (minutos antes del inicio)
              <input type="number" min={0} max={120} value={toleranciaMin} onChange={(e) => setTolerancia(Number(e.target.value))} className={campo} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={verificacion} onChange={(e) => setVerificacion(e.target.checked)} />
              Exigir verificación de identidad presencial
            </label>
            {error && <p className="text-red-600">{error}</p>}
            <button className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700">Crear sesión</button>
          </form>
        </Tarjeta>
      </div>

      <Tarjeta className="overflow-x-auto p-0">
        <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Inscriptos</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-5 py-2 font-medium">Apellido y nombre</th>
              <th className="px-5 py-2 font-medium">DNI</th>
              <th className="px-5 py-2 font-medium">Legajo</th>
              <th className="px-5 py-2 font-medium">Identidad</th>
            </tr>
          </thead>
          <tbody>
            {data.inscriptos.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-5 py-2">
                  {e.apellido}, {e.nombre}
                </td>
                <td className="px-5 py-2">{e.dni}</td>
                <td className="px-5 py-2">{e.legajo}</td>
                <td className="px-5 py-2">{e.estadoValidacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
