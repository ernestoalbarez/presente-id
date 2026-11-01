import { useState } from 'react';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { Boton, fechaHora, Tarjeta, Titulo, Vacio } from '../components/ui';

interface Validacion {
  id: string;
  dni: string;
  motivo: string | null;
  createdAt: string;
  estudiante: { nombre: string; apellido: string; legajo: string; carrera: string } | null;
  renaper: { nombre: string; apellido: string; fechaNac: string; fotoUrl: string } | null;
  dispositivo: { modelo: string | null; estado: string } | null;
}

/** Validaciones de identidad que el mock dejó en revisión manual. */
export function ValidacionesPage() {
  const { data, error, recargar } = usePolling<Validacion[]>('/validaciones');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const resolver = async (v: Validacion, accion: 'aprobar' | 'rechazar') => {
    const motivo = accion === 'rechazar' ? window.prompt('Motivo del rechazo (lo verá el estudiante):', 'La selfie no coincide con la foto del DNI') : undefined;
    if (motivo === null) return; // canceló el prompt
    setOcupado(v.id);
    try {
      await api(`/validaciones/${v.id}/${accion}`, { body: { motivo: motivo || undefined } });
      await recargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div>
      <Titulo sub="Casos que el proveedor de identidad (mock RENAPER) marcó para revisión manual. Se actualiza cada 3 s.">
        Validaciones de identidad
      </Titulo>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {data && data.length === 0 && <Vacio>No hay validaciones pendientes de revisión.</Vacio>}
      <div className="space-y-4">
        {data?.map((v) => (
          <Tarjeta key={v.id} className="flex items-center gap-5">
            {v.renaper && <img src={v.renaper.fotoUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />}
            <div className="flex-1 text-sm">
              <p className="text-base font-semibold">
                {v.estudiante ? `${v.estudiante.nombre} ${v.estudiante.apellido}` : 'Sin estudiante asociado'}
              </p>
              <p className="text-slate-600">
                DNI {v.dni} · {v.estudiante?.legajo} · {v.estudiante?.carrera}
              </p>
              {v.renaper && (
                <p className="text-slate-600">
                  RENAPER: {v.renaper.nombre} {v.renaper.apellido}, nac. {new Date(v.renaper.fechaNac).toLocaleDateString('es-AR')}
                </p>
              )}
              <p className="mt-1 text-amber-700">⚠ {v.motivo ?? 'Requiere revisión'}</p>
              <p className="text-slate-400">
                {fechaHora(v.createdAt)} · {v.dispositivo?.modelo ?? 'dispositivo desconocido'}
              </p>
            </div>
            <div className="flex gap-2">
              <Boton onClick={() => resolver(v, 'aprobar')} disabled={ocupado === v.id}>
                Aprobar
              </Boton>
              <Boton variante="peligro" onClick={() => resolver(v, 'rechazar')} disabled={ocupado === v.id}>
                Rechazar
              </Boton>
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
