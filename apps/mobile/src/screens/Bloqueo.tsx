import { useEffect, useState } from 'react';
import { Boton, Estado } from '../components/ui';
import { desbloquear } from '../lib/biometria';

/** Pide biometría/PIN antes de mostrar la credencial. */
export function Bloqueo({ onDesbloqueado }: { onDesbloqueado: () => void }) {
  const [estado, setEstado] = useState<'pidiendo' | 'cancelado' | 'no-disponible'>('pidiendo');

  const intentar = async () => {
    setEstado('pidiendo');
    const r = await desbloquear();
    if (r === 'OK') onDesbloqueado();
    else setEstado(r === 'CANCELADO' ? 'cancelado' : 'no-disponible');
  };

  useEffect(() => {
    void intentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (estado === 'no-disponible') {
    // Decisión de prototipo: si el teléfono no tiene ningún bloqueo configurado, se avisa y se deja pasar.
    return (
      <Estado
        icono="⚠️"
        titulo="Tu teléfono no tiene bloqueo"
        mensaje="Configurá huella, Face ID o un PIN en el teléfono para proteger tu credencial."
      >
        <Boton titulo="Continuar igual" onPress={onDesbloqueado} />
      </Estado>
    );
  }
  return (
    <Estado icono="🔒" titulo="Credencial bloqueada" mensaje="Usá tu huella, Face ID o PIN para ver tu credencial.">
      <Boton titulo="Desbloquear" onPress={intentar} deshabilitado={estado === 'pidiendo'} />
    </Estado>
  );
}
