// Escaneo de QRs de asistencia (y, en la etapa 5, de ingreso a sede).
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Boton, Campo, colores, Estado, Pantalla, Texto, Titulo } from '../components/ui';
import { DEMO_MODE } from '../lib/config';
import { procesarQr, type ResultadoEscaneo } from '../lib/escaneo';

export function Escanear() {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEscaneo | null>(null);
  const [manual, setManual] = useState('');
  // La cámara dispara onBarcodeScanned muchas veces por segundo: procesamos solo el primero.
  const ocupado = useRef(false);

  const procesar = async (contenido: string) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setProcesando(true);
    const r = await procesarQr(contenido);
    void Haptics.notificationAsync(r.tipo === 'PRESENTE' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    setResultado(r);
    setProcesando(false);
  };

  const otro = () => {
    setResultado(null);
    setManual('');
    ocupado.current = false;
  };

  if (resultado?.tipo === 'PRESENTE') return <PresenteOk r={resultado.presente} onOtro={otro} />;
  if (resultado?.tipo === 'ERROR') {
    return (
      <Estado icono="⚠️" titulo={resultado.titulo} mensaje={resultado.mensaje}>
        <Boton titulo="Escanear de nuevo" onPress={otro} />
      </Estado>
    );
  }
  if (procesando) return <Estado icono="📡" titulo="Registrando…" cargando />;
  if (!permiso) return <Estado icono="📷" titulo="Preparando la cámara…" cargando />;

  return (
    <Pantalla>
      <Titulo>Escanear</Titulo>
      <Texto suave>Apuntá al QR proyectado en el aula para dar presente.</Texto>
      {permiso.granted ? (
        <View style={s.marco}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => void procesar(data)}
          />
        </View>
      ) : (
        <Boton titulo="Permitir cámara" onPress={pedirPermiso} />
      )}
      {DEMO_MODE && (
        <View style={{ gap: 8 }}>
          <Campo label="Demo: pegá el contenido del QR" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} multiline />
          <Boton titulo="Simular escaneo" variante="secundario" onPress={() => void procesar(manual)} deshabilitado={!manual.trim()} />
        </View>
      )}
    </Pantalla>
  );
}

/** Confirmación del presente con una animación de "sello". */
function PresenteOk({ r, onOtro }: { r: Extract<ResultadoEscaneo, { tipo: 'PRESENTE' }>['presente']; onOtro: () => void }) {
  const escala = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(escala, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
  }, [escala]);

  const hora = new Date(r.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Pantalla centrada>
      <Animated.View style={[s.sello, { transform: [{ scale: escala }] }]}>
        <Text style={{ fontSize: 72, color: 'white' }}>✓</Text>
      </Animated.View>
      <Titulo>¡Presente!</Titulo>
      <Texto>
        {r.tipo === 'EXAMEN' ? 'Examen' : 'Clase'} de {r.curso}
      </Texto>
      <Texto suave>
        {r.aula} · {hora}
      </Texto>
      {r.requiereVerificacionIdentidad && (
        <Texto suave>Este examen requiere verificación de identidad: mostrale tu credencial al docente.</Texto>
      )}
      <Boton titulo="Listo" onPress={onOtro} />
    </Pantalla>
  );
}

const s = StyleSheet.create({
  marco: { height: 340, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  sello: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colores.ok,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
