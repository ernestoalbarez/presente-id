import type { SesionResumen } from '@presente/shared';
import { usePolling } from '../api/usePolling';
import { useAuth } from '../auth/AuthContext';
import { ListaSesiones } from '../components/ListaSesiones';
import { Tarjeta, Titulo, Vacio } from '../components/ui';

// Por ahora muestra las sesiones de hoy; los indicadores (% de asistencia, ingresos) llegan en la etapa 5.
export function DashboardPage() {
  const { usuario } = useAuth();
  const { data } = usePolling<SesionResumen[]>('/sesiones');
  return (
    <div>
      <Titulo sub={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}>Hola, {usuario?.nombre}</Titulo>
      <h2 className="mb-3 text-lg font-semibold">Sesiones de hoy</h2>
      {data?.length === 0 && <Vacio>No hay sesiones hoy.</Vacio>}
      {!!data?.length && (
        <Tarjeta className="overflow-x-auto p-0">
          <ListaSesiones sesiones={data} />
        </Tarjeta>
      )}
    </div>
  );
}
