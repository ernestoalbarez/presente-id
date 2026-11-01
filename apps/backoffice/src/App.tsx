import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AsistenciaPage } from './pages/AsistenciaPage';
import { AuditoriaPage } from './pages/AuditoriaPage';
import { CursoDetallePage } from './pages/CursoDetallePage';
import { CursosPage } from './pages/CursosPage';
import { DashboardPage } from './pages/DashboardPage';
import { DemoPage } from './pages/DemoPage';
import { DispositivosPage } from './pages/DispositivosPage';
import { IngresosPage } from './pages/IngresosPage';
import { SesionEnVivoPage } from './pages/SesionEnVivoPage';
import { VerificarConstanciaPage } from './pages/VerificarConstanciaPage';
import { ValidacionesPage } from './pages/ValidacionesPage';
import { VerificarIdentidadPage } from './pages/VerificarIdentidadPage';

export function App() {
  return (
    <Routes>
      {/* Pública: a esta página apunta el QR de cada constancia (no requiere login). */}
      <Route path="/verificar/:codigo" element={<VerificarConstanciaPage />} />
      <Route path="*" element={<Privado />} />
    </Routes>
  );
}

function Privado() {
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
        <Route path="/verificar-identidad" element={<VerificarIdentidadPage />} />
        <Route path="/cursos" element={<CursosPage />} />
        <Route path="/cursos/:id" element={<CursoDetallePage />} />
        <Route path="/sesiones/:id" element={<SesionEnVivoPage />} />
        <Route path="/asistencia" element={<AsistenciaPage />} />
        <Route path="/demo" element={<DemoPage />} />
        {usuario.rol === 'DIRECTIVO' && (
          <>
            <Route path="/dispositivos" element={<DispositivosPage />} />
            <Route path="/ingresos" element={<IngresosPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
            <Route path="/validaciones" element={<ValidacionesPage />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
