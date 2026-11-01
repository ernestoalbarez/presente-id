// Pantalla principal del estudiante validado: pestañas "Credencial" y "Escanear".
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PerfilEstudiante } from '@presente/shared';
import { colores } from '../components/ui';
import { Escanear } from './Escanear';
import { Inicio } from './Inicio';

const PESTANIAS = [
  { id: 'credencial', label: 'Credencial', icono: '🪪' },
  { id: 'escanear', label: 'Escanear', icono: '📷' },
] as const;
type Pestania = (typeof PESTANIAS)[number]['id'];

export function Principal({ perfil, onDesvincular }: { perfil: PerfilEstudiante; onDesvincular: () => void }) {
  const [pestania, setPestania] = useState<Pestania>('credencial');
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <View style={{ flex: 1 }}>
        {pestania === 'credencial' ? <Inicio perfil={perfil} onDesvincular={onDesvincular} /> : <Escanear />}
      </View>
      <View style={[s.barra, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {PESTANIAS.map((p) => (
          <Pressable key={p.id} onPress={() => setPestania(p.id)} style={s.tab}>
            <Text style={{ fontSize: 22 }}>{p.icono}</Text>
            <Text style={[s.tabTexto, pestania === p.id && { color: colores.primario, fontWeight: '700' }]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: 'white', paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabTexto: { fontSize: 12, color: colores.suave },
});
