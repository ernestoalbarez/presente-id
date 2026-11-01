import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import type { PerfilEstudiante } from '@presente/shared';
import { Boton, colores, Pantalla, Texto } from '../components/ui';
import { DEMO_MODE } from '../lib/config';

/** Credencial del estudiante. El QR dinámico de identidad se agrega en la etapa 3. */
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
        <Text style={s.institucion}>Instituto Universitario del Sur</Text>
        <Image source={{ uri: perfil.fotoUrl }} style={s.foto} />
        <Text style={s.nombre}>
          {perfil.nombre} {perfil.apellido}
        </Text>
        <Dato label="DNI" valor={perfil.dni} />
        <Dato label="Legajo" valor={perfil.legajo} />
        <Dato label="Carrera" valor={perfil.carrera} />
        <View style={s.estado}>
          <Text style={s.estadoTexto}>✓ IDENTIDAD VALIDADA</Text>
        </View>
      </View>
      <Texto suave>El QR dinámico de identidad llega en la próxima etapa.</Texto>
      {DEMO_MODE && <Boton titulo="Desvincular este teléfono (demo)" variante="peligro" onPress={confirmarDesvincular} />}
    </Pantalla>
  );
}

const Dato = ({ label, valor }: { label: string; valor: string }) => (
  <View style={s.dato}>
    <Text style={s.datoLabel}>{label}</Text>
    <Text style={s.datoValor}>{valor}</Text>
  </View>
);

const s = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  institucion: { fontSize: 13, fontWeight: '600', color: colores.primario, textTransform: 'uppercase', letterSpacing: 1 },
  foto: { width: 120, height: 120, borderRadius: 60, marginVertical: 8, backgroundColor: '#e2e8f0' },
  nombre: { fontSize: 22, fontWeight: '700', color: colores.texto, marginBottom: 8 },
  dato: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  datoLabel: { color: colores.suave, fontSize: 15 },
  datoValor: { color: colores.texto, fontSize: 15, fontWeight: '600' },
  estado: { marginTop: 12, backgroundColor: '#dcfce7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  estadoTexto: { color: colores.ok, fontWeight: '700', fontSize: 13 },
});
