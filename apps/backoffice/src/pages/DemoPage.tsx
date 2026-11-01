// Panel de modo demo: mover el reloj del servidor y forzar estados para mostrar casos sin esperar.
import type { EstadoDemo, SesionResumen } from '@presente/shared';
import { Link } from 'react-router';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { BadgeEstado, Boton, hora, Tarjeta, Titulo } from '../components/ui';

const SALTOS = [
  { texto: '+2 min', min: 2 },
  { texto: '+30 min', min: 30 },
  { texto: '+2 h', min: 120 },
  { texto: '+1 día', min: 1440 },
  { texto: '−1 h', min: -60 },
];

export function DemoPage() {
  const estado = usePolling<EstadoDemo>('/demo/estado');
  const sesiones = usePolling<SesionResumen[]>('/sesiones');
  const offset = estado.data?.offsetMin ?? 0;

  const mover = async (offsetMin: number) => {
    try {
      await api('/demo/reloj', { body: { offsetMin } });
      await Promise.all([estado.recargar(), sesiones.recargar()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const vencer = async (s: SesionResumen) => {
    if (!confirm(`¿Forzar como vencida la sesión de ${s.curso}? Su horario de fin pasa a hace un minuto.`)) return;
    await api(`/demo/sesiones/${s.id}/vencer`, { body: {} }).catch((e) => alert(e.message));
    await sesiones.recargar();
  };

  if (estado.data && !estado.data.demoMode) return <p className="text-slate-500">El modo demo está desactivado (DEMO_MODE=false).</p>;

  return (
    <div className="space-y-6">
      <Titulo sub="Todo lo que se hace acá queda en la auditoría. El desfase del reloj se pierde al reiniciar la API.">Modo demo</Titulo>

      <Tarjeta className="space-y-4">
        <div>
          <p className="text-sm text-slate-500">Hora del servidor</p>
          <p className="text-3xl font-bold">{estado.data ? new Date(estado.data.ahora).toLocaleString('es-AR') : '…'}</p>
          <p className={offset ? 'font-semibold text-pink-700' : 'text-slate-500'}>
            {offset ? `Reloj desfasado ${offset > 0 ? '+' : ''}${offset} min` : 'Reloj real'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SALTOS.map((s) => (
            <Boton key={s.texto} variante="secundario" onClick={() => mover(offset + s.min)}>
              {s.texto}
            </Boton>
          ))}
          <Boton onClick={() => mover(0)} disabled={!offset}>
            Volver a la hora real
          </Boton>
        </div>
        <p className="text-sm text-slate-500">
          Ejemplos: con +2 min, un QR de identidad capturado antes da <b>VENCIDO</b>. Con +1 día, las sesiones de hoy quedan fuera de horario. La app
          sincroniza su reloj con el del servidor, así que sigue generando QRs válidos.
        </p>
      </Tarjeta>

      <Tarjeta className="overflow-x-auto p-0">
        <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Forzar sesión vencida</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {sesiones.data?.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2.5">
                  {s.curso} · {s.tipo === 'EXAMEN' ? 'Examen' : 'Clase'}
                </td>
                <td className="px-5 py-2.5 text-slate-500">
                  {hora(s.inicio)}–{hora(s.fin)}
                </td>
                <td className="px-5 py-2.5">
                  <BadgeEstado estado={s.estado} />
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Boton variante="peligro" onClick={() => vencer(s)}>
                    Forzar vencida
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-semibold">Dispositivo revocado</h2>
        <p className="mt-1 text-sm text-slate-600">
          Revocá un teléfono desde{' '}
          <Link to="/dispositivos" className="text-indigo-700 hover:underline">
            Dispositivos
          </Link>{' '}
          (directivos), o desde la app con el botón de demo "Revocar este teléfono".
        </p>
      </Tarjeta>
    </div>
  );
}
