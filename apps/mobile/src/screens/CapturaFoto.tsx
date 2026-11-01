// Captura de foto (frente/dorso del DNI o selfie). Las fotos NO se envían ni se procesan:
// el mock de RENAPER decide por reglas sobre el DNI. Se capturan para que el flujo sea realista.
import { useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Boton, Estado, Pantalla, Texto, Titulo } from '../components/ui';
import { DEMO_MODE } from '../lib/config';

interface Props {
  titulo: string;
  instrucciones: string;
  camara: CameraType;
  onCapturada: (uri: string | null) => void;
  onVolver: () => void;
}

export function CapturaFoto({ titulo, instrucciones, camara, onCapturada, onVolver }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [sacando, setSacando] = useState(false);

  const sacar = async () => {
    setSacando(true);
    try {
      const r = await ref.current?.takePictureAsync({ quality: 0.3, shutterSound: false });
      if (r) setFoto(r.uri);
    } finally {
      setSacando(false);
    }
  };

  if (!permiso) return <Estado icono="📷" titulo="Preparando la cámara…" cargando />;

  if (!permiso.granted) {
    return (
      <Estado icono="📷" titulo={titulo} mensaje="Necesitamos acceso a la cámara para continuar.">
        <Boton titulo="Permitir cámara" onPress={pedirPermiso} />
        {DEMO_MODE && <Boton titulo="Simular foto (demo)" variante="secundario" onPress={() => onCapturada(null)} />}
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </Estado>
    );
  }

  return (
    <Pantalla>
      <Titulo>{titulo}</Titulo>
      <Texto suave>{instrucciones}</Texto>
      <View style={s.marco}>
        {foto ? (
          <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} />
        ) : (
          <CameraView ref={ref} style={StyleSheet.absoluteFill} facing={camara} />
        )}
      </View>
      {foto ? (
        <>
          <Boton titulo="Usar esta foto" onPress={() => onCapturada(foto)} />
          <Boton titulo="Repetir" variante="secundario" onPress={() => setFoto(null)} />
        </>
      ) : (
        <>
          <Boton titulo={sacando ? 'Capturando…' : 'Sacar foto'} onPress={sacar} deshabilitado={sacando} />
          {DEMO_MODE && <Boton titulo="Simular foto (demo)" variante="secundario" onPress={() => onCapturada(null)} />}
        </>
      )}
      <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
    </Pantalla>
  );
}

const s = StyleSheet.create({
  marco: { height: 340, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
});
