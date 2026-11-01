// Prepara apps/api/.env: lo crea a partir de .env.example si no existe y genera el par
// de claves Ed25519 del servidor si falta. También crea apps/mobile/.env con la IP local
// de la Mac si no existe. Con --force-keys regenera las claves siempre
// (invalida tokens y firmas emitidas antes).
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url));
const mobileEnvPath = fileURLToPath(new URL('../../mobile/.env', import.meta.url));
const force = process.argv.includes('--force-keys');

function lanIp(): string | undefined {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
}

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  console.log('Creado apps/api/.env a partir de .env.example');
  const ip = lanIp();
  if (ip) {
    const env = readFileSync(envPath, 'utf8').replace(/^BACKOFFICE_PUBLIC_URL=.*$/m, `BACKOFFICE_PUBLIC_URL=http://${ip}:5173`);
    writeFileSync(envPath, env);
  }
}

let env = readFileSync(envPath, 'utf8');
const tieneClaves = /^SERVER_ED25519_D=\S+/m.test(env) && /^SERVER_ED25519_X=\S+/m.test(env);

if (force || !tieneClaves) {
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' }); // { kty: 'OKP', crv: 'Ed25519', d, x }
  const set = (name: string, value: string) => {
    const re = new RegExp(`^${name}=.*$`, 'm');
    env = re.test(env) ? env.replace(re, `${name}=${value}`) : `${env.trimEnd()}\n${name}=${value}\n`;
  };
  set('SERVER_ED25519_D', jwk.d!);
  set('SERVER_ED25519_X', jwk.x!);
  writeFileSync(envPath, env);
  console.log('Generado par de claves Ed25519 del servidor en apps/api/.env');
}

if (!existsSync(mobileEnvPath)) {
  const ip = lanIp() ?? 'localhost';
  writeFileSync(mobileEnvPath, `EXPO_PUBLIC_API_URL=http://${ip}:3000\nEXPO_PUBLIC_DEMO_MODE=true\n`);
  console.log(`Creado apps/mobile/.env apuntando a http://${ip}:3000`);
}
