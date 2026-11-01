// QR de identidad dinámico. Se genera y firma EN el teléfono (sin conexión) con su clave
// privada, y rota cada 30 s: una captura de pantalla deja de servir enseguida, y cada QR
// lleva un nonce de un solo uso, así que tampoco sirve reenviarlo.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Crypto from 'expo-crypto';
import { base64url, generarQrIdentidad, ROTACION_QR_IDENTIDAD_S } from '@presente/shared';
import { obtenerClaveParaFirmar } from '../lib/dispositivo';
import { ahoraServidorSeg } from '../lib/reloj';
import { colores } from './ui';

export function QrIdentidad({ usuarioId }: { usuarioId: string }) {
  const [clave, setClave] = useState<Awaited<ReturnType<typeof obtenerClaveParaFirmar>>>(null);
  const [actual, setActual] = useState<{ qr: string; exp: number } | null>(null);
  const [restante, setRestante] = useState(ROTACION_QR_IDENTIDAD_S);

  useEffect(() => {
    void obtenerClaveParaFirmar().then(setClave);
  }, []);

  // Cada segundo actualizamos el contador; al vencer, generamos y firmamos un QR nuevo.
  const actualRef = useRef(actual);
  useEffect(() => {
    if (!clave) return;
    const tick = () => {
      const ahora = ahoraServidorSeg();
      let qr = actualRef.current;
      if (!qr || qr.exp <= ahora) {
        qr = generarQrIdentidad({
          usuarioId,
          deviceId: clave.deviceId,
          ahoraSeg: ahora,
          nonce: base64url.encode(Crypto.getRandomBytes(16)),
          clavePrivada: clave.clavePrivada,
        });
        actualRef.current = qr;
        setActual(qr);
      }
      setRestante(qr.exp - ahora);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clave, usuarioId]);

  if (!actual) return <View style={[s.qr, { height: 260 }]} />;

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={s.qr}>
        <QRCode value={actual.qr} size={230} ecl="M" />
      </View>
      <View style={s.barra}>
        <View style={[s.relleno, { width: `${(restante / ROTACION_QR_IDENTIDAD_S) * 100}%` }]} />
      </View>
      <Text style={{ color: colores.suave }}>Se renueva en {restante} s</Text>
    </View>
  );
}

const s = StyleSheet.create({
  qr: { padding: 14, backgroundColor: 'white', borderRadius: 16 },
  barra: { width: 230, height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  relleno: { height: 6, backgroundColor: colores.primario },
});
