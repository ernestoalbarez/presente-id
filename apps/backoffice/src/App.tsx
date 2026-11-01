import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DispositivosPage } from './pages/DispositivosPage';
import { ValidacionesPage } from './pages/ValidacionesPage';
import { VerificarIdentidadPage } from './pages/VerificarIdentidadPage';

export function App() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <p className="p-8 text-slate-500">Cargando…</p>;

  if (!usuario) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/verificar" element={<VerificarIdentidadPage />} />
        {usuario.rol === 'DIRECTIVO' && (
          <>
            <Route path="/dispositivos" element={<DispositivosPage />} />
            <Route path="/validaciones" element={<ValidacionesPage />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
