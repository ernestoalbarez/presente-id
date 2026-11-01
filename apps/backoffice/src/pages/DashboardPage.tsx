import { useAuth } from '../auth/AuthContext';

// Placeholder de la etapa 1: el dashboard con datos reales llega en la etapa 5.
export function DashboardPage() {
  const { usuario } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-bold">Hola, {usuario?.nombre}</h1>
      <p className="mt-2 text-slate-600">
        Sesión iniciada como <strong>{usuario?.rol === 'DIRECTIVO' ? 'directivo' : 'docente'}</strong>. El dashboard con
        sesiones de hoy, % de asistencia e ingresos se completa en la etapa 5.
      </p>
    </div>
  );
}
