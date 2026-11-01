// Navegación de la app como máquina de estados simple (sin librería de navegación):
// la pantalla depende de si hay token de dispositivo y de la situación que devuelve GET /yo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PerfilEstudiante } from '@presente/shared';
import { Boton, Estado } from './components/ui';
import { api, ApiError } from './lib/api';
import { desvincularLocalmente, tokenDispositivo } from './lib/dispositivo';
import { sincronizarConServidor } from './lib/reloj';
import { usePolling } from './lib/usePolling';
import { Bloqueo } from './screens/Bloqueo';
import { Principal } from './screens/Principal';
import { RegistroFlujo } from './screens/RegistroFlujo';

type Vista =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'registro' }
  | { tipo: 'espera'; perfil: PerfilEstudiante }
  | { tipo: 'final'; perfil: PerfilEstudiante }
  | { tipo: 'bloqueado'; perfil: PerfilEstudiante }
  | { tipo: 'inicio'; perfil: PerfilEstudiante };

export function App() {
  const [vista, setVista] = useState<Vista>({ tipo: 'cargando' });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;

  const refrescar = useCallback(async () => {
    if (!(await tokenDispositivo.get())) return setVista({ tipo: 'registro' });
    try {
      const perfil = await api<PerfilEstudiante>('/yo');
      sincronizarConServidor(perfil.ahoraServidor);
      const actual = vistaRef.current;
      if (perfil.situacion === 'ACTIVO') {
        // Si ya estaba desbloqueada, se queda en inicio; si no, pide biometría.
        setVista(actual.tipo === 'inicio' ? { tipo: 'inicio', perfil } : { tipo: 'bloqueado', perfil });
      } else if (perfil.situacion === 'EN_REVISION' || perfil.situacion === 'CAMBIO_PENDIENTE') {
        setVista({ tipo: 'espera', perfil });
      } else {
        setVista({ tipo: 'final', perfil });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // El servidor no reconoce este teléfono (p. ej. se re-seedeó la base): empezar de cero.
        await desvincularLocalmente();
        setVista({ tipo: 'registro' });
      } else if (vistaRef.current.tipo !== 'inicio' && vistaRef.current.tipo !== 'espera') {
        // Durante el polling, un corte de red momentáneo no saca al usuario de la pantalla actual.
        setVista({ tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) });
      }
    }
  }, []);

  const desvincular = useCallback(async () => {
    await desvincularLocalmente();
    setVista({ tipo: 'registro' });
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  // Polling de /yo cada 3 s: mientras se espera la aprobación de un directivo y también en la
  // credencial, para reflejar al instante si el dispositivo es revocado.
  usePolling(refrescar, vista.tipo === 'espera' || vista.tipo === 'inicio');

  // Al mandar la app a segundo plano, la credencial se vuelve a bloquear.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      const v = vistaRef.current;
      if (estado === 'background' && v.tipo === 'inicio') setVista({ tipo: 'bloqueado', perfil: v.perfil });
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Contenido vista={vista} refrescar={refrescar} desvincular={desvincular} setVista={setVista} />
    </SafeAreaProvider>
  );
}

function Contenido({
  vista,
  refrescar,
  desvincular,
  setVista,
}: {
  vista: Vista;
  refrescar: () => Promise<void>;
  desvincular: () => Promise<void>;
  setVista: (v: Vista) => void;
}) {
  switch (vista.tipo) {
    case 'cargando':
      return <Estado icono="🪪" titulo="PresenteID" cargando />;
    case 'error':
      return (
        <Estado icono="📡" titulo="Sin conexión" mensaje={vista.mensaje}>
          <Boton titulo="Reintentar" onPress={refrescar} />
        </Estado>
      );
    case 'registro':
      return <RegistroFlujo onRegistrado={refrescar} />;
    case 'espera':
      return vista.perfil.situacion === 'CAMBIO_PENDIENTE' ? (
        <Estado
          icono="📱"
          titulo="Cambio de dispositivo pendiente"
          mensaje="Tu cuenta ya está vinculada a otro teléfono. Un directivo tiene que aprobar el cambio; cuando lo haga, esta pantalla se actualiza sola."
          cargando
        />
      ) : (
        <Estado
          icono="🔎"
          titulo="Validación en revisión"
          mensaje={`${vista.perfil.motivo ?? 'Tu validación requiere revisión manual.'} Un directivo la va a revisar; esta pantalla se actualiza sola.`}
          cargando
        />
      );
    case 'final':
      return (
        <Estado
          icono="⛔️"
          titulo={vista.perfil.situacion === 'RECHAZADO' ? 'Validación rechazada' : 'Dispositivo desvinculado'}
          mensaje={vista.perfil.motivo}
        >
          <Boton titulo="Volver a registrarme" onPress={desvincular} />
        </Estado>
      );
    case 'bloqueado':
      return <Bloqueo onDesbloqueado={() => setVista({ tipo: 'inicio', perfil: vista.perfil })} />;
    case 'inicio':
      return <Principal perfil={vista.perfil} onDesvincular={desvincular} />;
  }
}
