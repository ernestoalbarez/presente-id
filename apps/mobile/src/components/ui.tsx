// Componentes visuales mínimos compartidos por todas las pantallas.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colores = {
  primario: '#4338ca',
  primarioClaro: '#eef2ff',
  texto: '#0f172a',
  suave: '#64748b',
  borde: '#cbd5e1',
  fondo: '#f8fafc',
  ok: '#15803d',
  error: '#b91c1c',
  alerta: '#b45309',
};

export function Pantalla({ children, centrada = false }: { children: ReactNode; centrada?: boolean }) {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={[s.contenido, centrada && s.centrada]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const Titulo = ({ children }: { children: ReactNode }) => <Text style={s.titulo}>{children}</Text>;
export const Texto = ({ children, suave }: { children: ReactNode; suave?: boolean }) => (
  <Text style={[s.texto, suave && { color: colores.suave }]}>{children}</Text>
);

export function Boton(props: { titulo: string; onPress: () => void; variante?: 'primario' | 'secundario' | 'peligro'; deshabilitado?: boolean }) {
  const { variante = 'primario' } = props;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.deshabilitado}
      style={({ pressed }) => [
        s.boton,
        variante === 'primario' && { backgroundColor: colores.primario },
        variante === 'secundario' && { borderWidth: 1, borderColor: colores.borde, backgroundColor: 'white' },
        variante === 'peligro' && { borderWidth: 1, borderColor: colores.error, backgroundColor: 'white' },
        (pressed || props.deshabilitado) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          s.botonTexto,
          { color: variante === 'primario' ? 'white' : variante === 'peligro' ? colores.error : colores.texto },
        ]}
      >
        {props.titulo}
      </Text>
    </Pressable>
  );
}

export function Campo({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={[s.input, error && { borderColor: colores.error }]} placeholderTextColor={colores.suave} {...props} />
      {error && <Text style={{ color: colores.error, fontSize: 13 }}>{error}</Text>}
    </View>
  );
}

/** Pantalla de estado: ícono grande, título, mensaje y acciones. */
export function Estado(props: { icono: string; titulo: string; mensaje?: string; cargando?: boolean; children?: ReactNode }) {
  return (
    <Pantalla centrada>
      <Text style={{ fontSize: 64, textAlign: 'center' }}>{props.icono}</Text>
      <Titulo>{props.titulo}</Titulo>
      {props.mensaje && <Texto suave>{props.mensaje}</Texto>}
      {props.cargando && <ActivityIndicator size="large" color={colores.primario} />}
      <View style={{ gap: 12, marginTop: 12 }}>{props.children}</View>
    </Pantalla>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 24, gap: 16, flexGrow: 1 },
  centrada: { justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: '700', color: colores.texto, textAlign: 'center' },
  texto: { fontSize: 16, color: colores.texto, textAlign: 'center', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: colores.texto },
  input: { borderWidth: 1, borderColor: colores.borde, borderRadius: 10, padding: 12, fontSize: 18, backgroundColor: 'white', color: colores.texto },
  boton: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  botonTexto: { fontSize: 16, fontWeight: '600' },
});
