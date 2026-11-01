import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import type { PerfilEstudiante } from '@presente/shared';
import { QrIdentidad } from '../components/QrIdentidad';
import { Boton, colores, Pantalla, Texto } from '../components/ui';
import { DEMO_MODE } from '../lib/config';

/** "Mi credencial": datos del estudiante + QR de identidad dinámico para mostrar a un docente. */
export function Inicio({ perfil, onDesvincular }: { perfil: PerfilEstudiante; onDesvincular: () => void }) {
  const confirmarDesvincular = () =>
    Alert.alert(
      'Desvincular este teléfono',
      'Se borran las claves de este teléfono. Al registrarte de nuevo, el sistema lo va a tratar como un dispositivo nuevo y un directivo tendrá que aprobar el cambio.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desvincular', style: 'destructive', onPress: onDesvincular },
      ],
    );

  return (
    <Pantalla>
      <View style={s.tarjeta}>
        <Text style={s.institucion}>{perfil.institucion}</Text>
        <View style={s.fila}>
          <Image source={{ uri: perfil.fotoUrl }} style={s.foto} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.nombre}>
              {perfil.nombre} {perfil.apellido}
            </Text>
            <Text style={s.dato}>DNI {perfil.dni}</Text>
            <Text style={s.dato}>Legajo {perfil.legajo}</Text>
            <Text style={s.dato}>{perfil.carrera}</Text>
          </View>
        </View>
        <View style={s.estado}>
          <Text style={s.estadoTexto}>✓ IDENTIDAD VALIDADA</Text>
        </View>
        <QrIdentidad usuarioId={perfil.usuarioId} />
      </View>
      <Texto suave>Mostrá este código al docente para verificar tu identidad.</Texto>
      {DEMO_MODE && <Boton titulo="Desvincular este teléfono (demo)" variante="peligro" onPress={confirmarDesvincular} />}
    </Pantalla>
  );
}

const s = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', borderRadius: 20, padding: 20, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  institucion: { fontSize: 13, fontWeight: '600', color: colores.primario, textTransform: 'uppercase', letterSpacing: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  foto: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e2e8f0' },
  nombre: { fontSize: 20, fontWeight: '700', color: colores.texto },
  dato: { fontSize: 14, color: colores.suave },
  estado: { backgroundColor: '#dcfce7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, alignSelf: 'stretch', alignItems: 'center' },
  estadoTexto: { color: colores.ok, fontWeight: '700', fontSize: 13 },
});
