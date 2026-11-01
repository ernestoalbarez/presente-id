// Historial del estudiante: presentes e ingresos/egresos, en una sola línea de tiempo.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { HistorialApp } from '@presente/shared';
import { colores, Texto, Titulo } from '../components/ui';
import { api } from '../lib/api';

interface Item {
  id: string;
  icono: string;
  titulo: string;
  detalle: string;
  fecha: string;
}

function aItems(h: HistorialApp): Item[] {
  const asistencias = h.asistencias.map((a) => ({
    id: `a-${a.id}`,
    icono: a.tipo === 'EXAMEN' ? '📝' : '✅',
    titulo: `${a.tipo === 'EXAMEN' ? 'Examen' : 'Clase'} · ${a.curso}`,
    detalle: [a.metodo === 'MANUAL' ? 'Cargado por el docente' : 'Presente por QR', a.verificadaPresencialmente && 'identidad verificada'].filter(Boolean).join(' · '),
    fecha: a.fecha,
  }));
  const ingresos = h.ingresos.map((i) => ({
    id: `i-${i.id}`,
    icono: i.tipo === 'INGRESO' ? '🚪' : '👋',
    titulo: `${i.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} · ${i.sede}`,
    detalle: i.punto,
    fecha: i.timestamp,
  }));
  return [...asistencias, ...ingresos].sort((x, y) => y.fecha.localeCompare(x.fecha));
}

export function Historial() {
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(aItems(await api<HistorialApp>('/yo/historial')));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      ListHeaderComponent={
        <View style={{ gap: 6, marginBottom: 8, paddingTop: 40 }}>
          <Titulo>Historial</Titulo>
          {error && <Text style={{ color: colores.error, textAlign: 'center' }}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={cargando ? undefined : <Texto suave>Todavía no hay actividad.</Texto>}
      renderItem={({ item }) => (
        <View style={s.fila}>
          <Text style={{ fontSize: 24 }}>{item.icono}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>{item.titulo}</Text>
            <Text style={s.detalle}>{item.detalle}</Text>
          </View>
          <Text style={s.fecha}>
            {new Date(item.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  titulo: { fontWeight: '600', color: colores.texto },
  detalle: { color: colores.suave, fontSize: 13 },
  fecha: { color: colores.suave, fontSize: 12 },
});
