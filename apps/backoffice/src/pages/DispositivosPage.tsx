import { useState } from 'react';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { Boton, fechaHora, Tarjeta, Titulo, Vacio } from '../components/ui';

interface ResumenDispositivo {
  id: string;
  modelo: string | null;
  estado: string;
  createdAt: string;
  activadoAt: string | null;
}
interface Solicitud {
  id: string;
  createdAt: string;
  estudiante: { nombre: string; apellido: string; dni?: string; legajo?: string; fotoUrl?: string };
  dispositivoNuevo: ResumenDispositivo;
  dispositivoAnterior: ResumenDispositivo | null;
}
interface DispositivoActivo extends ResumenDispositivo {
  estudiante: { nombre: string; apellido: string; dni?: string; legajo?: string };
}

export function DispositivosPage() {
  const solicitudes = usePolling<Solicitud[]>('/dispositivos/solicitudes');
  const activos = usePolling<DispositivoActivo[]>('/dispositivos');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const accion = async (id: string, path: string, body: object = {}) => {
    setOcupado(id);
    try {
      await api(path, { body });
      await Promise.all([solicitudes.recargar(), activos.recargar()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  const revocar = (d: DispositivoActivo) => {
    const motivo = window.prompt(`Revocar el dispositivo de ${d.estudiante.nombre} ${d.estudiante.apellido}. Motivo:`, 'Teléfono perdido');
    if (motivo !== null) void accion(d.id, `/dispositivos/${d.id}/revocar`, { motivo });
  };

  return (
    <div className="space-y-10">
      <section>
        <Titulo sub="Un estudiante solo puede tener un teléfono activo. Al aprobar, el anterior queda revocado.">
          Solicitudes de cambio de dispositivo
        </Titulo>
        {solicitudes.error && <p className="mb-4 text-red-600">{solicitudes.error}</p>}
        {solicitudes.data?.length === 0 && <Vacio>No hay solicitudes pendientes.</Vacio>}
        <div className="space-y-4">
          {solicitudes.data?.map((s) => (
            <Tarjeta key={s.id} className="flex items-center gap-5">
              {s.estudiante.fotoUrl && <img src={s.estudiante.fotoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />}
              <div className="flex-1 text-sm">
                <p className="text-base font-semibold">
                  {s.estudiante.nombre} {s.estudiante.apellido}
                </p>
                <p className="text-slate-600">
                  DNI {s.estudiante.dni} · Legajo {s.estudiante.legajo} · solicitado {fechaHora(s.createdAt)}
                </p>
                <p className="mt-1">
                  <span className="text-slate-500">Actual:</span> {s.dispositivoAnterior?.modelo ?? '—'}{' '}
                  {s.dispositivoAnterior?.activadoAt && `(desde ${fechaHora(s.dispositivoAnterior.activadoAt)})`}
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="text-slate-500">Nuevo:</span> {s.dispositivoNuevo.modelo ?? '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <Boton onClick={() => accion(s.id, `/dispositivos/solicitudes/${s.id}/aprobar`)} disabled={ocupado === s.id}>
                  Aprobar
                </Boton>
                <Boton variante="peligro" onClick={() => accion(s.id, `/dispositivos/solicitudes/${s.id}/rechazar`)} disabled={ocupado === s.id}>
                  Rechazar
                </Boton>
              </div>
            </Tarjeta>
          ))}
        </div>
      </section>

      <section>
        <Titulo sub="Revocar corta el acceso de ese teléfono de inmediato.">Dispositivos activos</Titulo>
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Estudiante</th>
                <th className="px-5 py-3 font-medium">DNI</th>
                <th className="px-5 py-3 font-medium">Dispositivo</th>
                <th className="px-5 py-3 font-medium">Activo desde</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {activos.data?.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3">
                    {d.estudiante.apellido}, {d.estudiante.nombre}
                  </td>
                  <td className="px-5 py-3">{d.estudiante.dni}</td>
                  <td className="px-5 py-3">{d.modelo}</td>
                  <td className="px-5 py-3">{d.activadoAt && fechaHora(d.activadoAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Boton variante="peligro" onClick={() => revocar(d)} disabled={ocupado === d.id}>
                      Revocar
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </section>
    </div>
  );
}
