import type { Dashboard, SesionResumen } from '@presente/shared';
import { Link } from 'react-router';
import { usePolling } from '../api/usePolling';
import { useAuth } from '../auth/AuthContext';
import { ListaSesiones } from '../components/ListaSesiones';
import { Tarjeta, Titulo, Vacio } from '../components/ui';

function Indicador({ titulo, valor, detalle, to }: { titulo: string; valor: string; detalle?: string; to?: string }) {
  const contenido = (
    <Tarjeta className={to ? 'transition hover:border-indigo-300' : ''}>
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold">{valor}</p>
      {detalle && <p className="mt-1 text-sm text-slate-500">{detalle}</p>}
    </Tarjeta>
  );
  return to ? <Link to={to}>{contenido}</Link> : contenido;
}

export function DashboardPage() {
  const { usuario } = useAuth();
  const sesiones = usePolling<SesionResumen[]>('/sesiones');
  const { data: d } = usePolling<Dashboard>('/reportes/dashboard');
  const pctHoy = d && d.esperadosHoy > 0 ? `${Math.round((d.presentesHoy / d.esperadosHoy) * 100)}%` : '—';

  return (
    <div className="space-y-8">
      <Titulo sub={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}>Hola, {usuario?.nombre}</Titulo>

      {d && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador titulo="Sesiones de hoy" valor={String(d.sesionesHoy)} />
          <Indicador titulo="Asistencia de hoy" valor={pctHoy} detalle={`${d.presentesHoy} de ${d.esperadosHoy} presentes`} />
          <Indicador titulo="Asistencia últimos 7 días" valor={d.asistenciaSemanaPct === null ? '—' : `${d.asistenciaSemanaPct}%`} to="/asistencia" />
          {d.ingresosHoy !== null && <Indicador titulo="Ingresos a sede hoy" valor={String(d.ingresosHoy)} to="/ingresos" />}
          {!!d.validacionesPendientes && <Indicador titulo="Validaciones en revisión" valor={String(d.validacionesPendientes)} to="/validaciones" />}
          {!!d.solicitudesPendientes && <Indicador titulo="Cambios de dispositivo pendientes" valor={String(d.solicitudesPendientes)} to="/dispositivos" />}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sesiones de hoy</h2>
        {sesiones.data?.length === 0 && <Vacio>No hay sesiones hoy.</Vacio>}
        {!!sesiones.data?.length && (
          <Tarjeta className="overflow-x-auto p-0">
            <ListaSesiones sesiones={sesiones.data} />
          </Tarjeta>
        )}
      </section>
    </div>
  );
}
