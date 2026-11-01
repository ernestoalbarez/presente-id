import { generateKeyPairSync } from 'node:crypto';
import { defineConfig } from 'vitest/config';

// Los tests usan una base SQLite propia (prisma/test.db) y un par de claves efímero,
// así no dependen de apps/api/.env ni pisan la base de desarrollo.
const jwk = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
const env = {
  DATABASE_URL: 'file:./test.db',
  SERVER_ED25519_D: jwk.d!,
  SERVER_ED25519_X: jwk.x!,
  DEMO_MODE: 'true',
  MOCK_RENAPER_LATENCIA_MS: '0',
};
Object.assign(process.env, env); // para globalSetup (corre en este proceso)

// Dos proyectos: "unit" (*.unit.test.ts, sin base de datos) e "integration" (resetea y
// carga el seed en test.db antes de correr). `vitest run --project unit` corre solo los unitarios.
export default defineConfig({
  test: {
    env,
    fileParallelism: false, // los tests de integración comparten la misma base
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.unit.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.unit.test.ts'],
          globalSetup: ['src/test/globalSetup.ts'],
        },
      },
    ],
  },
});
