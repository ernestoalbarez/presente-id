// Identidad del teléfono: deviceId + par de claves Ed25519. La clave privada se genera acá
// y nunca sale del dispositivo: queda en SecureStore (Keychain en iOS / Keystore en Android).
// Al servidor solo se le manda la clave pública.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { base64url, clavePublicaDe } from '@presente/shared';

const K = {
  deviceId: 'presente.deviceId',
  clavePrivada: 'presente.clavePrivada',
  token: 'presente.deviceToken',
};

const opciones: SecureStore.SecureStoreOptions = {
  // La clave no se copia a backups ni a otro teléfono.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface IdentidadDispositivo {
  deviceId: string;
  publicKey: string; // base64url
}

/** Devuelve la identidad del teléfono, creándola la primera vez. */
export async function obtenerOCrearIdentidad(): Promise<IdentidadDispositivo> {
  let deviceId = await SecureStore.getItemAsync(K.deviceId, opciones);
  let priv = await SecureStore.getItemAsync(K.clavePrivada, opciones);
  if (!deviceId || !priv) {
    deviceId = Crypto.randomUUID();
    // Una clave privada Ed25519 son 32 bytes aleatorios (CSPRNG del sistema operativo).
    priv = base64url.encode(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(K.deviceId, deviceId, opciones);
    await SecureStore.setItemAsync(K.clavePrivada, priv, opciones);
  }
  return { deviceId, publicKey: base64url.encode(clavePublicaDe(base64url.decode(priv))) };
}

export const tokenDispositivo = {
  get: () => SecureStore.getItemAsync(K.token, opciones),
  set: (t: string) => SecureStore.setItemAsync(K.token, t, opciones),
};

/** Borra todo lo local: el teléfono pasa a comportarse como uno nuevo (otro deviceId y otra clave). */
export async function desvincularLocalmente() {
  await Promise.all(Object.values(K).map((k) => SecureStore.deleteItemAsync(k, opciones)));
}
