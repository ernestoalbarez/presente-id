import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { registroSchema } from '@presente/shared';
import { Boton, Campo, colores, Pantalla, Texto, Titulo } from '../components/ui';

export interface DatosDni {
  dni: string;
  sexo: 'M' | 'F' | 'X';
  nroTramite: string;
}

const esquema = registroSchema.pick({ dni: true, sexo: true, nroTramite: true });

/** Paso 1 del registro: datos del DNI. */
export function RegistroDatos({ inicial, onContinuar }: { inicial?: DatosDni; onContinuar: (d: DatosDni) => void }) {
  const [dni, setDni] = useState(inicial?.dni ?? '');
  const [sexo, setSexo] = useState<DatosDni['sexo'] | undefined>(inicial?.sexo);
  const [nroTramite, setNroTramite] = useState(inicial?.nroTramite ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const continuar = () => {
    const r = esquema.safeParse({ dni, sexo, nroTramite });
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    onContinuar(r.data);
  };

  return (
    <Pantalla>
      <Titulo>Validá tu identidad</Titulo>
      <Texto suave>Ingresá los datos tal como figuran en tu DNI. Paso 1 de 4.</Texto>
      <Campo label="Número de DNI" value={dni} onChangeText={setDni} keyboardType="number-pad" maxLength={8} placeholder="44901231" error={errores.dni} />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600' }}>Sexo</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['F', 'M', 'X'] as const).map((op) => (
            <Pressable
              key={op}
              onPress={() => setSexo(op)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                alignItems: 'center',
                borderColor: sexo === op ? colores.primario : colores.borde,
                backgroundColor: sexo === op ? colores.primarioClaro : 'white',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: sexo === op ? colores.primario : colores.texto }}>{op}</Text>
            </Pressable>
          ))}
        </View>
        {errores.sexo && <Text style={{ color: colores.error, fontSize: 13 }}>{errores.sexo}</Text>}
      </View>
      <Campo
        label="Número de trámite"
        value={nroTramite}
        onChangeText={setNroTramite}
        keyboardType="number-pad"
        maxLength={11}
        placeholder="11 dígitos, al frente del DNI"
        error={errores.nroTramite}
      />
      <Boton titulo="Continuar" onPress={continuar} />
    </Pantalla>
  );
}
