// Panel de modo demo dentro de la app (solo con EXPO_PUBLIC_DEMO_MODE=true): mover el reloj
// del servidor y revocar este teléfono para mostrar casos sin esperar ni usar dos celulares.
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { EstadoDemo } from '@presente/shared';
import { api } from '../lib/api';
import { ahoraServidorSeg } from '../lib/reloj';
import { Boton, colores } from './ui';

export function PanelDemo({ onDesvincular }: { onDesvincular: () => void }) {
  const [offset, setOffset] = useState<number | null>(null);

  const mover = async (offsetMin: number) => {
    try {
      const r = await api<EstadoDemo>('/demo/reloj', { body: { offsetMin } });
      setOffset(r.offsetMin); // la app toma la hora nueva en el próximo GET /yo (≤ 3 s)
    } catch (e) {
      Alert.alert('Demo', e instanceof Error ? e.message : String(e));
    }
  };

  const revocar = () =>
    Alert.alert('Revocar este teléfono', 'El servidor lo marca como REVOCADO, como si lo hiciera un directivo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar',
        style: 'destructive',
        onPress: () => void api('/demo/mi-dispositivo/revocar', { body: {} }).catch((e) => Alert.alert('Demo', String(e))),
      },
    ]);

  const desvincular = () =>
    Alert.alert(
      'Desvincular este teléfono',
      'Se borran las claves locales. Al registrarte de nuevo, el sistema lo trata como un dispositivo nuevo y un directivo tiene que aprobar el cambio.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desvincular', style: 'destructive', onPress: onDesvincular },
      ],
    );

  return (
    <View style={s.panel}>
      <Text style={s.titulo}>🧪 Modo demo</Text>
      <Text style={s.texto}>
        Hora del servidor: {new Date(ahoraServidorSeg() * 1000).toLocaleTimeString('es-AR')}
        {offset ? ` (${offset > 0 ? '+' : ''}${offset} min)` : ''}
      </Text>
      <View style={s.fila}>
        <View style={{ flex: 1 }}>
          <Boton titulo="Reloj +2 min" variante="secundario" onPress={() => mover((offset ?? 0) + 2)} />
        </View>
        <View style={{ flex: 1 }}>
          <Boton titulo="Hora real" variante="secundario" onPress={() => mover(0)} />
        </View>
      </View>
      <Boton titulo="Revocar este teléfono" variante="peligro" onPress={revocar} />
      <Boton titulo="Desvincular (borrar claves)" variante="peligro" onPress={desvincular} />
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#f9a8d4', borderRadius: 16, padding: 14, backgroundColor: '#fdf2f8' },
  titulo: { fontWeight: '700', color: '#9d174d' },
  texto: { color: colores.suave, fontSize: 13 },
  fila: { flexDirection: 'row', gap: 8 },
});
