import { NavLink, Outlet } from 'react-router';
import type { RolStaff } from '@presente/shared';
import { usePolling } from '../api/usePolling';
import { useAuth } from '../auth/AuthContext';

// Menú por rol. Las pantallas sin `to` se habilitan en las etapas siguientes.
const MENU: Array<{ label: string; to?: string; roles: RolStaff[] }> = [
  { label: 'Dashboard', to: '/', roles: ['DOCENTE', 'DIRECTIVO'] },
  { label: 'Cursos', to: '/cursos', roles: ['DOCENTE', 'DIRECTIVO'] },
  { label: 'Verificar identidad', to: '/verificar-identidad', roles: ['DOCENTE', 'DIRECTIVO'] },
  { label: 'Asistencia', to: '/asistencia', roles: ['DOCENTE', 'DIRECTIVO'] },
  { label: 'Ingresos', to: '/ingresos', roles: ['DIRECTIVO'] },
  { label: 'Dispositivos', to: '/dispositivos', roles: ['DIRECTIVO'] },
  { label: 'Validaciones', to: '/validaciones', roles: ['DIRECTIVO'] },
  { label: 'Auditoría', to: '/auditoria', roles: ['DIRECTIVO'] },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  // /health dice si DEMO_MODE está activo y si el reloj del servidor está desfasado.
  const { data: salud } = usePolling<{ demoMode: boolean; offsetMin: number }>('/health');
  if (!usuario) return null;
  const menu = salud?.demoMode ? [...MENU, { label: 'Modo demo', to: '/demo', roles: ['DOCENTE', 'DIRECTIVO'] as RolStaff[] }] : MENU;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-4 text-lg font-bold text-indigo-700">PresenteID</div>
        <nav className="flex-1 space-y-1 px-3">
          {menu.filter((m) => m.roles.includes(usuario.rol)).map((m) =>
            m.to ? (
              <NavLink
                key={m.label}
                to={m.to}
                end={m.to === '/'}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`
                }
              >
                {m.label}
              </NavLink>
            ) : (
              <span key={m.label} className="block cursor-not-allowed px-3 py-2 text-sm text-slate-400" title="Próximamente">
                {m.label}
              </span>
            ),
          )}
        </nav>
        <div className="border-t border-slate-200 p-4 text-sm">
          <p className="font-medium">
            {usuario.nombre} {usuario.apellido}
          </p>
          <p className="text-slate-500">{usuario.rol === 'DIRECTIVO' ? 'Directivo' : 'Docente'}</p>
          <button onClick={logout} className="mt-2 text-indigo-700 hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        {!!salud?.offsetMin && (
          <NavLink to="/demo" className="mb-6 block rounded-lg bg-pink-100 px-4 py-2 text-sm font-medium text-pink-800">
            Modo demo: el reloj del servidor está desfasado {salud.offsetMin > 0 ? '+' : ''}
            {salud.offsetMin} min. Tocá acá para volver a la hora real.
          </NavLink>
        )}
        <Outlet />
      </main>
    </div>
  );
}
