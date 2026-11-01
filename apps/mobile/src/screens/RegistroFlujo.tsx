// Flujo de registro: datos del DNI → frente → dorso → selfie → validación (mock RENAPER).
// Al validar, el teléfono genera su par de claves y registra la clave pública en el servidor.
import { useState } from 'react';
import { Platform } from 'react-native';
import type { RegistroResponse } from '@presente/shared';
import { Boton, Estado } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { desvincularLocalmente, obtenerOCrearIdentidad, tokenDispositivo } from '../lib/dispositivo';
import { CapturaFoto } from './CapturaFoto';
import { RegistroDatos, type DatosDni } from './RegistroDatos';

type Paso =
  | { tipo: 'datos' }
  | { tipo: 'frente' | 'dorso' | 'selfie' }
  | { tipo: 'enviando' }
  | { tipo: 'fallo'; titulo: string; mensaje: string };

export function RegistroFlujo({ onRegistrado }: { onRegistrado: () => void }) {
  const [paso, setPaso] = useState<Paso>({ tipo: 'datos' });
  const [datos, setDatos] = useState<DatosDni>();

  const enviar = async () => {
    if (!datos) return;
    setPaso({ tipo: 'enviando' });
    try {
      const identidad = await obtenerOCrearIdentidad();
      const r = await api<RegistroResponse>('/registro', {
        body: { ...datos, ...identidad, modelo: `${Platform.OS} ${Platform.Version}` },
      });
      if (r.deviceToken) await tokenDispositivo.set(r.deviceToken);
      if (r.estado === 'RECHAZADO') {
        setPaso({ tipo: 'fallo', titulo: 'Identidad no validada', mensaje: r.motivo ?? 'RENAPER rechazó la validación.' });
        return;
      }
      onRegistrado(); // VALIDADO, EN_REVISION o CAMBIO_DISPOSITIVO_PENDIENTE: la app consulta /yo
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      if (err.codigo === 'DISPOSITIVO_REVOCADO' || err.codigo === 'DISPOSITIVO_EN_USO') {
        // Este deviceId ya no sirve: generamos una identidad de teléfono nueva para el próximo intento.
        await desvincularLocalmente();
      }
      const titulo = err.codigo === 'NO_INSCRIPTO' ? 'No estás inscripto' : 'No se pudo completar el registro';
      setPaso({ tipo: 'fallo', titulo, mensaje: err.message });
    }
  };

  switch (paso.tipo) {
    case 'datos':
      return (
        <RegistroDatos
          inicial={datos}
          onContinuar={(d) => {
            setDatos(d);
            setPaso({ tipo: 'frente' });
          }}
        />
      );
    case 'frente':
      return (
        <CapturaFoto
          titulo="Frente del DNI"
          instrucciones="Paso 2 de 4. Encuadrá el frente de tu DNI con buena luz."
          camara="back"
          onCapturada={() => setPaso({ tipo: 'dorso' })}
          onVolver={() => setPaso({ tipo: 'datos' })}
        />
      );
    case 'dorso':
      return (
        <CapturaFoto
          titulo="Dorso del DNI"
          instrucciones="Paso 3 de 4. Ahora el dorso, con el código de barras visible."
          camara="back"
          onCapturada={() => setPaso({ tipo: 'selfie' })}
          onVolver={() => setPaso({ tipo: 'frente' })}
        />
      );
    case 'selfie':
      return (
        <CapturaFoto
          titulo="Prueba de vida"
          instrucciones="Paso 4 de 4. Mirá a la cámara, sin anteojos de sol ni gorra."
          camara="front"
          onCapturada={() => void enviar()}
          onVolver={() => setPaso({ tipo: 'dorso' })}
        />
      );
    case 'enviando':
      return <Estado icono="🪪" titulo="Validando tu identidad" mensaje="Consultando a RENAPER…" cargando />;
    case 'fallo':
      return (
        <Estado icono="⛔️" titulo={paso.titulo} mensaje={paso.mensaje}>
          <Boton titulo="Revisar mis datos" onPress={() => setPaso({ tipo: 'datos' })} />
        </Estado>
      );
  }
}
