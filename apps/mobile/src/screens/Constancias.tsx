// "Mis constancias": galería de constancias de presencia, con detalle y QR de verificación pública.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { ConstanciaApp } from '@presente/shared';
import { Insignia } from '../components/Insignia';
import { Boton, colores, Pantalla, Texto, Titulo } from '../components/ui';
import { api } from '../lib/api';

export function Constancias() {
  const [lista, setLista] = useState<ConstanciaApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<ConstanciaApp | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLista(await api<ConstanciaApp[]>('/yo/constancias'));
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

  if (!lista && !error) return <ActivityIndicator style={{ flex: 1 }} color={colores.primario} />;

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <FlatList
        data={lista ?? []}
        keyExtractor={(c) => c.codigo}
        numColumns={2}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        columnWrapperStyle={{ gap: 16 }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListHeaderComponent={
          <View style={{ gap: 6, marginBottom: 8, paddingTop: 40 }}>
            <Titulo>Mis constancias</Titulo>
            <Texto suave>Cada presente genera una constancia firmada por la institución.</Texto>
            {error && <Text style={{ color: colores.error, textAlign: 'center' }}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={<Texto suave>Todavía no tenés constancias. ¡Dá presente en una clase!</Texto>}
        renderItem={({ item }) => (
          <Pressable style={s.celda} onPress={() => setAbierta(item)}>
            <Insignia c={item} />
            <Text style={s.curso} numberOfLines={2}>
              {item.curso}
            </Text>
            <Text style={s.sub}>{item.tipo === 'EXAMEN' ? 'Examen' : 'Clase'}</Text>
          </Pressable>
        )}
      />
      <Modal visible={!!abierta} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAbierta(null)}>
        {abierta && <Detalle c={abierta} onCerrar={() => setAbierta(null)} />}
      </Modal>
    </View>
  );
}

function Detalle({ c, onCerrar }: { c: ConstanciaApp; onCerrar: () => void }) {
  const fecha = new Date(c.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Pantalla>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Insignia c={c} tamanio={150} />
        <Titulo>{c.curso}</Titulo>
        <Texto>
          {c.tipo === 'EXAMEN' ? 'Examen' : 'Clase'} · {fecha}
        </Texto>
        <Texto suave>
          {c.sede} · {c.aula}
        </Texto>
        <Texto suave>Titular: {c.titular}</Texto>
      </View>
      <View style={s.verificacion}>
        <QRCode value={c.urlVerificacion} size={150} />
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{c.codigo}</Text>
        <Text style={s.hash}>SHA-256 {c.hash.slice(0, 16)}…</Text>
        <Texto suave>Quien escanee este QR puede comprobar que la constancia es auténtica.</Texto>
      </View>
      <Boton titulo="Abrir verificación" variante="secundario" onPress={() => void Linking.openURL(c.urlVerificacion)} />
      <Boton titulo="Cerrar" onPress={onCerrar} />
    </Pantalla>
  );
}

const s = StyleSheet.create({
  celda: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: 'white', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  curso: { fontWeight: '700', textAlign: 'center', color: colores.texto },
  sub: { color: colores.suave, fontSize: 12 },
  verificacion: { alignItems: 'center', gap: 8, backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  hash: { fontFamily: 'Courier', color: colores.suave, fontSize: 12 },
});
