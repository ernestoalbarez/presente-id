import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Pide biometría (o el PIN/patrón del teléfono como alternativa) antes de mostrar la credencial.
 * Si el teléfono no tiene ningún bloqueo configurado, devuelve 'NO_DISPONIBLE' y la app decide.
 */
export async function desbloquear(): Promise<'OK' | 'CANCELADO' | 'NO_DISPONIBLE'> {
  const [hardware, enrolado] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  const nivel = await LocalAuthentication.getEnrolledLevelAsync();
  if ((!hardware || !enrolado) && nivel === LocalAuthentication.SecurityLevel.NONE) return 'NO_DISPONIBLE';

  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloqueá tu credencial',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false, // permite usar el PIN del teléfono
  });
  return r.success ? 'OK' : 'CANCELADO';
}
