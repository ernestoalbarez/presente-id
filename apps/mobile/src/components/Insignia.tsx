// Insignia visual de una constancia (estilo POAP): círculo de color derivado del curso con
// las iniciales, un ícono según el tipo de evento y la fecha.
import { StyleSheet, Text, View } from 'react-native';
import type { ConstanciaApp } from '@presente/shared';

const PALETA = ['#4338ca', '#0f766e', '#b45309', '#be185d', '#1d4ed8', '#7c3aed', '#15803d', '#c2410c'];

/** Color estable por curso (mismo curso → mismo color). */
function colorDe(curso: string) {
  let h = 0;
  for (const c of curso) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

const iniciales = (curso: string) =>
  curso
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZIVX]+$/.test(p))
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export function Insignia({ c, tamanio = 96 }: { c: Pick<ConstanciaApp, 'curso' | 'tipo' | 'fecha'>; tamanio?: number }) {
  const color = colorDe(c.curso);
  return (
    <View style={[s.aro, { width: tamanio, height: tamanio, borderRadius: tamanio / 2, borderColor: color }]}>
      <View style={[s.centro, { borderRadius: tamanio / 2, backgroundColor: color }]}>
        <Text style={{ fontSize: tamanio * 0.18 }}>{c.tipo === 'EXAMEN' ? '📝' : '🎓'}</Text>
        <Text style={[s.iniciales, { fontSize: tamanio * 0.22 }]}>{iniciales(c.curso)}</Text>
        <Text style={[s.fecha, { fontSize: tamanio * 0.11 }]}>
          {new Date(c.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aro: { borderWidth: 4, padding: 4, backgroundColor: 'white' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iniciales: { color: 'white', fontWeight: '800', letterSpacing: 1 },
  fecha: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
});
